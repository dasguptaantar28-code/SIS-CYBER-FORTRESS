import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listModules(organizationId: string) {
    const [modules, openAlertsByModule] = await Promise.all([
      this.prisma.securityModule.findMany({
        orderBy: { number: 'asc' },
        include: {
          statuses: { where: { organizationId } },
        },
      }),
      this.prisma.securityAlert.groupBy({
        by: ['moduleId'],
        where: { organizationId, status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
        _count: true,
      }),
    ]);

    const alertCountMap = new Map(openAlertsByModule.map((a) => [a.moduleId, a._count]));

    return modules.map((m) => {
      const st = m.statuses[0];
      const openAlerts = alertCountMap.get(m.id) ?? 0;
      const derivedScore = Math.max(0, Math.min(100, (st?.postureScore ?? 100) - openAlerts * 4));
      return {
        id: m.id,
        code: m.code,
        slug: m.slug,
        number: m.number,
        name: m.name,
        shortName: m.shortName,
        category: m.category,
        description: m.description,
        platformSupport: m.platformSupport,
        isEnabled: m.isEnabled,
        healthStatus: !m.isEnabled ? 'OFFLINE' : openAlerts >= 5 ? 'DEGRADED' : st?.healthStatus ?? 'HEALTHY',
        postureScore: m.isEnabled ? derivedScore : 0,
        openAlertCount: openAlerts,
        lastCheckedAt: st?.lastCheckedAt ?? m.updatedAt,
      };
    });
  }

  async getModuleBySlug(organizationId: string, slug: string) {
    const list = await this.listModules(organizationId);
    const mod = list.find((m) => m.slug === slug);
    if (!mod) throw new NotFoundException(`Module "${slug}" not found.`);

    const recentAlerts = await this.prisma.securityAlert.findMany({
      where: { organizationId, moduleId: mod.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const recentAudit = await this.prisma.auditLog.findMany({
      where: { organizationId, moduleCode: mod.code },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return { module: mod, recentAlerts, recentAudit };
  }

  async toggleModule(actor: AuthenticatedUser, slug: string, isEnabled: boolean) {
    const mod = await this.prisma.securityModule.findUnique({ where: { slug } });
    if (!mod) throw new NotFoundException(`Module "${slug}" not found.`);

    const updated = await this.prisma.securityModule.update({
      where: { id: mod.id },
      data: { isEnabled },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: isEnabled ? 'MODULE_ENABLED' : 'MODULE_DISABLED',
      resourceType: 'SecurityModule',
      resourceId: mod.id,
      moduleCode: mod.code,
    });

    await this.notificationsService.notifyOrgAdmins(actor.organizationId, {
      title: `Module ${mod.shortName} ${isEnabled ? 'Enabled' : 'Disabled'}`,
      message: `${actor.email} changed ${mod.name} status to ${isEnabled ? 'ACTIVE' : 'OFFLINE'}.`,
      severity: isEnabled ? 'INFO' : 'MEDIUM',
      moduleCode: mod.code,
      deepLink: `/modules/${mod.slug}`,
    });

    return updated;
  }
}
