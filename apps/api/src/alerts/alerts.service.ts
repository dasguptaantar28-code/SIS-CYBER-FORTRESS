import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocEventsGateway } from '../notifications/soc-events.gateway';
import { CreateAlertDto, UpdateAlertStatusDto } from './dto/alerts.dto';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly socGateway: SocEventsGateway,
  ) {}

  private isPrivilegedViewer(user: AuthenticatedUser): boolean {
    return user.roles.some((r) =>
      ['SUPER_ADMIN', 'SECURITY_ADMIN', 'MODULE_ADMIN', 'AUDITOR'].includes(r),
    );
  }

  async createAlert(user: AuthenticatedUser, dto: CreateAlertDto) {
    const mod = await this.prisma.securityModule.findUnique({ where: { code: dto.moduleCode } });
    if (!mod) throw new BadRequestException(`Unknown security module code: ${dto.moduleCode}`);

    const alert = await this.prisma.securityAlert.create({
      data: {
        organizationId: user.organizationId,
        moduleId: mod.id,
        deviceId: dto.deviceId,
        assetId: dto.assetId,
        userId: user.id,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        status: 'OPEN',
        category: dto.category,
        geoCountry: dto.geoCountry,
        geoCity: dto.geoCity,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      include: { module: true, device: true, asset: true },
    });

    this.socGateway.emitOrgSocEvent(user.organizationId, 'alert:created', alert);

    if (dto.severity === 'HIGH' || dto.severity === 'CRITICAL') {
      await this.notificationsService.notifyOrgAdmins(user.organizationId, {
        title: `${dto.severity} Alert (${mod.shortName})`,
        message: dto.title,
        severity: dto.severity,
        moduleCode: mod.code,
        deepLink: '/alerts',
        resourceType: 'SecurityAlert',
        resourceId: alert.id,
      });
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'SECURITY_ALERT_CREATED',
      resourceType: 'SecurityAlert',
      resourceId: alert.id,
      moduleCode: mod.code,
      details: { severity: dto.severity, category: dto.category },
    });

    return alert;
  }

  async listAlerts(
    user: AuthenticatedUser,
    query: { moduleCode?: string; severity?: string; status?: string; search?: string },
  ) {
    const where: Prisma.SecurityAlertWhereInput = {
      organizationId: user.organizationId,
      ...(this.isPrivilegedViewer(user) ? {} : { userId: user.id }),
      ...(query.severity ? { severity: query.severity as Prisma.EnumSeverityLevelFilter } : {}),
      ...(query.status ? { status: query.status as Prisma.EnumAlertStatusFilter } : {}),
      ...(query.moduleCode ? { module: { code: query.moduleCode } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.securityAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: {
        module: { select: { code: true, shortName: true, slug: true } },
        device: { select: { id: true, deviceName: true } },
        asset: { select: { id: true, name: true, domain: true } },
        acknowledgedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async updateStatus(user: AuthenticatedUser, alertId: string, dto: UpdateAlertStatusDto) {
    const existing = await this.prisma.securityAlert.findFirst({
      where: { id: alertId, organizationId: user.organizationId },
      include: { module: true },
    });
    if (!existing) throw new NotFoundException('Security alert not found.');

    const updated = await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        status: dto.status,
        acknowledgedById: dto.status === 'ACKNOWLEDGED' ? user.id : existing.acknowledgedById,
        resolvedAt: dto.status === 'RESOLVED' ? new Date() : existing.resolvedAt,
      },
      include: { module: true },
    });

    this.socGateway.emitOrgSocEvent(user.organizationId, 'alert:updated', updated);

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'SECURITY_ALERT_STATUS_UPDATED',
      resourceType: 'SecurityAlert',
      resourceId: alertId,
      moduleCode: existing.module.code,
      details: { previousStatus: existing.status, newStatus: dto.status },
    });

    return updated;
  }

  async escalateToIncident(user: AuthenticatedUser, alertId: string) {
    const alert = await this.prisma.securityAlert.findFirst({
      where: { id: alertId, organizationId: user.organizationId },
      include: { module: true },
    });
    if (!alert) throw new NotFoundException('Security alert not found.');

    const count = await this.prisma.incident.count({ where: { organizationId: user.organizationId } });
    const incidentNumber = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const priorityMap: Record<string, number> = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4,
      INFO: 5,
    };

    const incident = await this.prisma.incident.create({
      data: {
        organizationId: user.organizationId,
        incidentNumber,
        title: `[Escalated] ${alert.title}`,
        description: alert.description,
        severity: alert.severity,
        status: 'OPEN',
        priority: priorityMap[alert.severity] ?? 3,
        sourceModuleCode: alert.module.code,
        createdById: user.id,
        alertLinks: {
          create: { alertId: alert.id },
        },
      },
    });

    await this.prisma.securityAlert.update({
      where: { id: alert.id },
      data: { status: 'IN_PROGRESS', acknowledgedById: user.id },
    });

    this.socGateway.emitOrgSocEvent(user.organizationId, 'incident:created', incident);

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'ALERT_ESCALATED_TO_INCIDENT',
      resourceType: 'Incident',
      resourceId: incident.id,
      moduleCode: 'CYBER_SOC',
      details: { alertId, incidentNumber },
    });

    return incident;
  }
}
