import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateRolePermissionsDto, UpdateUserRolesDto, UpdateUserStatusDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listUsers(organizationId: string, search?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { include: { role: true } },
        _count: { select: { devices: true, sessions: true } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      status: u.status,
      mfaEnabled: u.mfaEnabled,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.roles.map((r) => ({ code: r.role.code, name: r.role.name })),
      deviceCount: u._count.devices,
      sessionCount: u._count.sessions,
    }));
  }

  async updateUserRoles(actor: AuthenticatedUser, targetUserId: string, dto: UpdateUserRolesDto) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found.');
    if (dto.roleCodes.length === 0) {
      throw new BadRequestException('At least one role must be assigned.');
    }

    const roles = await this.prisma.role.findMany({
      where: { code: { in: dto.roleCodes } },
    });
    if (roles.length !== dto.roleCodes.length) {
      throw new BadRequestException('One or more specified role codes do not exist.');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: targetUserId } }),
      this.prisma.userRole.createMany({
        data: roles.map((r) => ({
          userId: targetUserId,
          roleId: r.id,
          assignedBy: actor.id,
        })),
      }),
    ]);

    await this.auditService.record({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.roles.join(','),
      action: 'USER_ROLES_UPDATED',
      resourceType: 'User',
      resourceId: targetUserId,
      moduleCode: 'ACCESS_GUARDIAN',
      details: { newRoles: dto.roleCodes },
    });

    await this.notificationsService.createAndDispatch({
      organizationId: actor.organizationId,
      userId: targetUserId,
      title: 'Account Access Roles Updated',
      message: `Your assigned roles were updated to: ${dto.roleCodes.join(', ')}.`,
      severity: 'MEDIUM',
      moduleCode: 'ACCESS_GUARDIAN',
      deepLink: '/modules/access-guardian',
    });

    return { userId: targetUserId, roles: dto.roleCodes };
  }

  async updateUserStatus(actor: AuthenticatedUser, targetUserId: string, dto: UpdateUserStatusDto) {
    if (actor.id === targetUserId && dto.status !== 'ACTIVE') {
      throw new BadRequestException('Administrators cannot suspend or lock their own account.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found.');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { status: dto.status },
      }),
      ...(dto.status !== 'ACTIVE'
        ? [
            this.prisma.userSession.updateMany({
              where: { userId: targetUserId, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]
        : []),
    ]);

    await this.auditService.record({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'USER_STATUS_UPDATED',
      resourceType: 'User',
      resourceId: targetUserId,
      moduleCode: 'ACCESS_GUARDIAN',
      details: { status: dto.status, reason: dto.reason },
    });

    return { userId: targetUserId, status: dto.status };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.code),
    }));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  async updateRolePermissions(
    actor: AuthenticatedUser,
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found.');
    if (role.code === 'SUPER_ADMIN') {
      throw new BadRequestException('SUPER_ADMIN permissions cannot be stripped.');
    }

    const perms = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
    });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
      }),
    ]);

    await this.auditService.record({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'ROLE_PERMISSIONS_UPDATED',
      resourceType: 'Role',
      resourceId: roleId,
      moduleCode: 'ACCESS_GUARDIAN',
      details: { roleCode: role.code, permissionCount: perms.length },
    });

    return { roleId, code: role.code, permissions: perms.map((p) => p.code) };
  }

  async listOrgSessions(organizationId: string) {
    return this.prisma.userSession.findMany({
      where: { user: { organizationId } },
      orderBy: { lastActivityAt: 'desc' },
      take: 100,
      select: {
        id: true,
        clientType: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        revokedAt: true,
        lastActivityAt: true,
        createdAt: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async revokeOrgSession(actor: AuthenticatedUser, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, user: { organizationId: actor.organizationId } },
      include: { user: true },
    });
    if (!session) throw new NotFoundException('Session not found.');

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'ADMIN_SESSION_REVOKED',
      resourceType: 'UserSession',
      resourceId: sessionId,
      moduleCode: 'ACCESS_GUARDIAN',
      details: { targetUserEmail: session.user.email },
    });

    return { revoked: true, sessionId };
  }
}
