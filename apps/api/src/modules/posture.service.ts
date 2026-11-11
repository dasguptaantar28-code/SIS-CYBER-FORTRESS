import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocEventsGateway } from '../notifications/soc-events.gateway';

export interface NetworkAssessmentInput {
  deviceId?: string;
  connectionType: string;
  transportLabel: string;
  isVpnActive: boolean;
  isMetered: boolean;
  wifiSecurityType: string;
  ssidVisibilityNote: string;
  checklistState: Record<string, boolean>;
}

export interface RansomwareReadinessInput {
  deviceId?: string;
  checklistState: Record<string, boolean>;
  canaryStatus: string;
  notes?: string;
  markDrillCompleted?: boolean;
}

@Injectable()
export class PostureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly socGateway: SocEventsGateway,
  ) {}

  async submitNetworkAssessment(user: AuthenticatedUser, input: NetworkAssessmentInput) {
    const warnings: string[] = [];
    let riskScore = 0;

    const isOpen = input.wifiSecurityType.toUpperCase() === 'OPEN' || input.wifiSecurityType.toUpperCase() === 'WEP';
    if (isOpen) {
      riskScore += 55;
      warnings.push('Unencrypted or deprecated WEP/Open Wi-Fi network detected; enable trusted VPN immediately.');
    }
    if (!input.isVpnActive && input.connectionType.toUpperCase() === 'WIFI') {
      riskScore += 20;
      warnings.push('No active VPN tunnel detected on Wi-Fi transport.');
    }
    if (input.checklistState && Object.values(input.checklistState).filter(Boolean).length < 3) {
      riskScore += 15;
      warnings.push('Complete remaining network hardening checklist controls.');
    }
    riskScore = Math.min(100, riskScore);

    const record = await this.prisma.networkAssessment.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        deviceId: input.deviceId,
        connectionType: input.connectionType,
        transportLabel: input.transportLabel,
        isVpnActive: input.isVpnActive,
        isMetered: input.isMetered,
        wifiSecurityType: input.wifiSecurityType,
        ssidVisibilityNote: input.ssidVisibilityNote,
        isOpenOrUnsafe: isOpen,
        riskScore,
        checklistState: (input.checklistState ?? {}) as Prisma.InputJsonValue,
        warnings,
      },
    });

    if (isOpen) {
      const mod = await this.prisma.securityModule.findUnique({ where: { code: 'NETWORK_SENTINEL' } });
      if (mod) {
        const alert = await this.prisma.securityAlert.create({
          data: {
            organizationId: user.organizationId,
            moduleId: mod.id,
            deviceId: input.deviceId,
            userId: user.id,
            title: 'Open or Unsafe Wi-Fi Network Warning',
            description: warnings.join(' '),
            severity: 'HIGH',
            status: 'OPEN',
            category: 'UNSAFE_NETWORK',
            sourceRef: `network:${record.id}`,
          },
        });
        this.socGateway.emitOrgSocEvent(user.organizationId, 'alert:created', alert);
      }

      await this.notificationsService.createAndDispatch({
        organizationId: user.organizationId,
        userId: user.id,
        title: 'Unsafe Wi-Fi Connection Warning',
        message: 'Connected to an Open or weak Wi-Fi network. Avoid sensitive sessions without a VPN.',
        severity: 'HIGH',
        moduleCode: 'NETWORK_SENTINEL',
        deepLink: '/modules/network-sentinel',
      });
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'NETWORK_ASSESSMENT_RECORDED',
      resourceType: 'NetworkAssessment',
      resourceId: record.id,
      moduleCode: 'NETWORK_SENTINEL',
      details: { connectionType: input.connectionType, isOpenOrUnsafe: isOpen, riskScore },
    });

    return record;
  }

  async listNetworkAssessments(user: AuthenticatedUser) {
    const isAdmin = user.roles.some((r) =>
      ['SUPER_ADMIN', 'SECURITY_ADMIN', 'MODULE_ADMIN', 'AUDITOR'].includes(r),
    );
    return this.prisma.networkAssessment.findMany({
      where: {
        organizationId: user.organizationId,
        ...(isAdmin ? {} : { userId: user.id }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        device: { select: { id: true, deviceName: true } },
      },
      take: 50,
    });
  }

  async updateRansomwareReadiness(user: AuthenticatedUser, input: RansomwareReadinessInput) {
    const verifiedBackups = await this.prisma.backupJob.count({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        status: { in: ['VERIFIED_SUCCESS', 'RESTORED'] },
      },
    });
    const backupVerified = verifiedBackups > 0;

    const checkedControls = Object.values(input.checklistState || {}).filter(Boolean).length;
    const totalControls = Math.max(Object.keys(input.checklistState || {}).length, 5);
    const checklistPoints = Math.round((checkedControls / totalControls) * 50);
    const readinessScore = Math.min(
      100,
      (backupVerified ? 40 : 0) +
        checklistPoints +
        (input.canaryStatus === 'MONITORING_HEALTHY' ? 10 : 0),
    );

    const existing = await this.prisma.ransomwareReadiness.findFirst({
      where: { userId: user.id, deviceId: input.deviceId ?? null },
    });

    const saved = existing
      ? await this.prisma.ransomwareReadiness.update({
          where: { id: existing.id },
          data: {
            readinessScore,
            backupVerified,
            checklistState: input.checklistState as Prisma.InputJsonValue,
            canaryStatus: input.canaryStatus,
            notes: input.notes,
            lastDrillAt: input.markDrillCompleted ? new Date() : existing.lastDrillAt,
          },
        })
      : await this.prisma.ransomwareReadiness.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            deviceId: input.deviceId ?? null,
            readinessScore,
            backupVerified,
            checklistState: input.checklistState as Prisma.InputJsonValue,
            canaryStatus: input.canaryStatus,
            notes: input.notes,
            lastDrillAt: input.markDrillCompleted ? new Date() : null,
          },
        });

    if (input.canaryStatus === 'SUSPICIOUS_ACTIVITY_REPORTED') {
      const mod = await this.prisma.securityModule.findUnique({
        where: { code: 'RANSOMWARE_GUARDIAN' },
      });
      if (mod) {
        const alert = await this.prisma.securityAlert.create({
          data: {
            organizationId: user.organizationId,
            moduleId: mod.id,
            deviceId: input.deviceId,
            userId: user.id,
            title: 'Suspicious File-Change Indicator Reported',
            description:
              input.notes ||
              'User/endpoint flagged rapid unexpected file modification indicators on monitored folder.',
            severity: 'CRITICAL',
            status: 'OPEN',
            category: 'RANSOMWARE_INDICATOR',
          },
        });
        this.socGateway.emitOrgSocEvent(user.organizationId, 'alert:created', alert);
      }
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'RANSOMWARE_READINESS_UPDATED',
      resourceType: 'RansomwareReadiness',
      resourceId: saved.id,
      moduleCode: 'RANSOMWARE_GUARDIAN',
      details: { readinessScore, backupVerified, canaryStatus: input.canaryStatus },
    });

    return { ...saved, verifiedBackupsCount: verifiedBackups };
  }

  async getRansomwareSummary(user: AuthenticatedUser) {
    const [records, verifiedBackups] = await Promise.all([
      this.prisma.ransomwareReadiness.findMany({
        where: { organizationId: user.organizationId, userId: user.id },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.backupJob.findMany({
        where: {
          organizationId: user.organizationId,
          userId: user.id,
          status: { in: ['VERIFIED_SUCCESS', 'RESTORED'] },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      readinessRecords: records,
      verifiedBackups,
      backupReadinessVerified: verifiedBackups.length > 0,
    };
  }
}
