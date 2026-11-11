import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { ModulesService } from '../modules/modules.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulesService: ModulesService,
    private readonly auditService: AuditService,
  ) {}

  async getHealth() {
    let dbHealthy = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }

    return {
      status: dbHealthy ? 'HEALTHY' : 'DEGRADED',
      service: 'sis-cyber-fortress-api',
      version: process.env.APP_VERSION || '1.0.0',
      database: dbHealthy ? 'CONNECTED' : 'UNREACHABLE',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getOverview(user: AuthenticatedUser) {
    const orgId = user.organizationId;
    const isAdminOrSoc = user.roles.some((r) =>
      ['SUPER_ADMIN', 'SECURITY_ADMIN', 'MODULE_ADMIN', 'AUDITOR'].includes(r),
    );

    const sevenDaysAgo = new Date(Date.now() - 6 * 86_400_000);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      modules,
      devices,
      alerts,
      incidents,
      scans,
      backups,
      integrations,
      recentAudits,
      assetsCount,
      casesCount,
    ] = await Promise.all([
      this.modulesService.listModules(orgId),
      this.prisma.device.findMany({
        where: { organizationId: orgId, deletedAt: null, ...(isAdminOrSoc ? {} : { userId: user.id }) },
      }),
      this.prisma.securityAlert.findMany({
        where: { organizationId: orgId, ...(isAdminOrSoc ? {} : { userId: user.id }) },
        orderBy: { createdAt: 'desc' },
        include: {
          module: { select: { code: true, shortName: true, slug: true } },
          device: { select: { deviceName: true } },
          asset: { select: { domain: true } },
        },
        take: 100,
      }),
      isAdminOrSoc
        ? this.prisma.incident.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as Prisma.IncidentGetPayload<Record<string, never>>[]),
      this.prisma.scanJob.findMany({
        where: { organizationId: orgId, createdAt: { gte: sevenDaysAgo } },
        include: { result: true },
      }),
      this.prisma.backupJob.findMany({
        where: { organizationId: orgId, ...(isAdminOrSoc ? {} : { userId: user.id }) },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.integrationStatus.findMany({
        where: { organizationId: orgId },
        orderBy: { category: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: orgId, ...(isAdminOrSoc ? {} : { actorUserId: user.id }) },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.registeredAsset.count({ where: { organizationId: orgId, deletedAt: null } }),
      isAdminOrSoc
        ? this.prisma.forensicCase.count({ where: { organizationId: orgId, deletedAt: null } })
        : Promise.resolve(0),
    ]);

    const openAlerts = alerts.filter((a) =>
      ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(a.status),
    );
    const blockedThreats =
      alerts.filter((a) => a.status === 'RESOLVED').length +
      scans.filter((s) => s.result?.riskLevel === 'HIGH_RISK' || s.result?.riskLevel === 'SUSPICIOUS')
        .length;
    const activeIncidents = incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.status));

    const verifiedBackups = backups.filter(
      (b) => b.status === 'VERIFIED_SUCCESS' || b.status === 'RESTORED',
    );
    const failedBackups = backups.filter((b) => b.status === 'FAILED');
    const backupStatus =
      backups.length === 0
        ? 'NOT_RUN_YET'
        : failedBackups.length > 0 && verifiedBackups.length === 0
          ? 'FAILED'
          : verifiedBackups.length > 0
            ? 'HEALTHY'
            : 'IN_PROGRESS';

    const avgModuleScore =
      modules.length > 0
        ? Math.round(modules.reduce((sum, m) => sum + m.postureScore, 0) / modules.length)
        : 100;
    const avgDeviceScore =
      devices.length > 0
        ? Math.round(devices.reduce((sum, d) => sum + d.postureScore, 0) / devices.length)
        : 100;
    const criticalPenalty = openAlerts.filter((a) => a.severity === 'CRITICAL').length * 10;
    const overallSecurityPosture = Math.max(
      0,
      Math.min(100, Math.round(avgModuleScore * 0.6 + avgDeviceScore * 0.4 - criticalPenalty)),
    );

    // 7-Day Trend calculated strictly from real persisted Alerts & ScanJobs
    const trendDays: Array<{ date: string; label: string; threatsDetected: number; mitigatedOrScanned: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const isoDay = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayAlerts = alerts.filter((a) => a.createdAt.toISOString().slice(0, 10) === isoDay);
      const dayScans = scans.filter((s) => s.createdAt.toISOString().slice(0, 10) === isoDay);
      trendDays.push({
        date: isoDay,
        label,
        threatsDetected: dayAlerts.filter((a) => a.severity !== 'INFO').length,
        mitigatedOrScanned:
          dayAlerts.filter((a) => a.status === 'RESOLVED').length + dayScans.length,
      });
    }

    const severityDistribution = {
      CRITICAL: alerts.filter((a) => a.severity === 'CRITICAL').length,
      HIGH: alerts.filter((a) => a.severity === 'HIGH').length,
      MEDIUM: alerts.filter((a) => a.severity === 'MEDIUM').length,
      LOW: alerts.filter((a) => a.severity === 'LOW').length,
      INFO: alerts.filter((a) => a.severity === 'INFO').length,
    };

    const geoThreats = alerts
      .filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number')
      .map((a) => ({
        id: a.id,
        title: a.title,
        severity: a.severity,
        country: a.geoCountry,
        city: a.geoCity,
        latitude: a.latitude!,
        longitude: a.longitude!,
        createdAt: a.createdAt,
      }));

    return {
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      demoSeedActive: process.env.ENABLE_DEMO_SEED === 'true' && process.env.NODE_ENV !== 'production',
      kpis: {
        totalModules: modules.length,
        activeModules: modules.filter((m) => m.isEnabled).length,
        registeredDevices: devices.length,
        compliantDevices: devices.filter((d) => d.complianceStatus === 'COMPLIANT').length,
        openSecurityAlerts: openAlerts.length,
        blockedThreats,
        activeIncidents: activeIncidents.length,
        backupStatus,
        lastBackupAt: backups[0]?.completedAt ?? backups[0]?.createdAt ?? null,
        overallSecurityPosture,
        registeredAssets: assetsCount,
        forensicCases: casesCount,
      },
      modules,
      trend7Days: trendDays,
      severityDistribution,
      geoTelemetry: {
        hasLiveGeoData: geoThreats.length > 0,
        note:
          geoThreats.length > 0
            ? 'Plotting geolocated security events recorded in database.'
            : 'No geolocated threat coordinates recorded yet; configure GeoIP or submit geo-tagged events.',
        points: geoThreats,
      },
      recentActivities: alerts.slice(0, 8).map((a) => ({
        id: a.id,
        timestamp: a.createdAt,
        event: a.title,
        sourceModule: a.module.shortName,
        moduleSlug: a.module.slug,
        severity: a.severity,
        status: a.status,
        target: a.device?.deviceName || a.asset?.domain || a.category,
      })),
      recentAuditEvents: recentAudits,
      integrations,
    };
  }

  async globalSearch(user: AuthenticatedUser, rawQuery: string) {
    const q = (rawQuery || '').trim();
    if (q.length < 2) return { query: q, results: [] };

    const orgId = user.organizationId;
    const isAdminOrSoc = user.roles.some((r) =>
      ['SUPER_ADMIN', 'SECURITY_ADMIN', 'MODULE_ADMIN', 'AUDITOR'].includes(r),
    );
    const [modules, alerts, devices, assets, iocs] = await Promise.all([
      this.prisma.securityModule.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 6,
      }),
      this.prisma.securityAlert.findMany({
        where: {
          organizationId: orgId,
          ...(isAdminOrSoc ? {} : { userId: user.id }),
          title: { contains: q, mode: 'insensitive' },
        },
        take: 6,
      }),
      this.prisma.device.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(isAdminOrSoc ? {} : { userId: user.id }),
          deviceName: { contains: q, mode: 'insensitive' },
        },
        take: 6,
      }),
      this.prisma.registeredAsset.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { domain: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 6,
      }),
      this.prisma.threatIndicator.findMany({
        where: { organizationId: orgId, isActive: true, value: { contains: q, mode: 'insensitive' } },
        take: 6,
      }),
    ]);

    return {
      query: q,
      results: [
        ...modules.map((m) => ({ type: 'MODULE', id: m.id, title: m.name, subtitle: m.category, href: `/modules/${m.slug}` })),
        ...alerts.map((a) => ({ type: 'ALERT', id: a.id, title: a.title, subtitle: a.severity, href: '/alerts' })),
        ...devices.map((d) => ({ type: 'DEVICE', id: d.id, title: d.deviceName, subtitle: d.complianceStatus, href: '/devices' })),
        ...assets.map((a) => ({ type: 'ASSET', id: a.id, title: a.name, subtitle: a.domain, href: '/assets' })),
        ...iocs.map((i) => ({ type: 'IOC', id: i.id, title: i.value, subtitle: `${i.indicatorType} • ${i.severity}`, href: '/modules/threat-intelligence' })),
      ],
    };
  }

  async getSettings(organizationId: string) {
    const [settings, integrations] = await Promise.all([
      this.prisma.systemSetting.findMany({ where: { organizationId }, orderBy: { key: 'asc' } }),
      this.prisma.integrationStatus.findMany({ where: { organizationId }, orderBy: { category: 'asc' } }),
    ]);
    return { settings, integrations };
  }

  async upsertSetting(user: AuthenticatedUser, key: string, value: Record<string, unknown>) {
    const saved = await this.prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: user.organizationId, key } },
      update: { value: value as Prisma.InputJsonValue, updatedById: user.id },
      create: {
        organizationId: user.organizationId,
        key,
        value: value as Prisma.InputJsonValue,
        updatedById: user.id,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'SYSTEM_SETTING_UPDATED',
      resourceType: 'SystemSetting',
      resourceId: saved.id,
      moduleCode: 'CYBER_SOC',
      details: { key },
    });

    return saved;
  }
}
