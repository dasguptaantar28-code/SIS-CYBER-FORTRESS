import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocEventsGateway } from '../notifications/soc-events.gateway';
import { RegisterDeviceDto } from './dto/devices.dto';

@Injectable()
export class DevicesService {
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

  private evaluatePosture(dto: RegisterDeviceDto): {
    score: number;
    complianceStatus: string;
    findings: string[];
  } {
    let score = 100;
    const findings: string[] = [];

    if (dto.isRootedOrCompromised) {
      score -= 45;
      findings.push('Potential root/compromise indicators detected.');
    }
    if (dto.screenLockEnabled === false) {
      score -= 25;
      findings.push('Device screen lock / keyguard is not enabled.');
    }
    if (dto.encryptionEnabled === false) {
      score -= 25;
      findings.push('Device storage encryption is disabled or unavailable.');
    }
    if (dto.biometricSupported === false) {
      score -= 5;
      findings.push('Hardware biometric prompt unavailable; PIN fallback recommended.');
    }
    if ((dto.highRiskPermissionCount ?? 0) > 10) {
      score -= 10;
      findings.push(`Elevated sensitive permission footprint (${dto.highRiskPermissionCount} apps).`);
    }

    score = Math.max(0, Math.min(100, score));
    const complianceStatus =
      dto.isRootedOrCompromised || score < 60
        ? 'NON_COMPLIANT'
        : score < 85
          ? 'AT_RISK'
          : 'COMPLIANT';

    return { score, complianceStatus, findings };
  }

  async registerOrSync(user: AuthenticatedUser, dto: RegisterDeviceDto) {
    const posture = this.evaluatePosture(dto);
    const existing = await this.prisma.device.findUnique({
      where: {
        organizationId_deviceIdentifier: {
          organizationId: user.organizationId,
          deviceIdentifier: dto.deviceIdentifier,
        },
      },
    });

    const isNewDevice = !existing || existing.deletedAt !== null;

    const saved = await this.prisma.device.upsert({
      where: {
        organizationId_deviceIdentifier: {
          organizationId: user.organizationId,
          deviceIdentifier: dto.deviceIdentifier,
        },
      },
      update: {
        userId: user.id,
        deviceName: dto.deviceName,
        platform: dto.platform,
        manufacturer: dto.manufacturer,
        model: dto.model,
        osVersion: dto.osVersion,
        securityPatchLevel: dto.securityPatchLevel,
        appVersion: dto.appVersion,
        isRootedOrCompromised: dto.isRootedOrCompromised ?? false,
        screenLockEnabled: dto.screenLockEnabled ?? true,
        biometricSupported: dto.biometricSupported ?? false,
        encryptionEnabled: dto.encryptionEnabled ?? true,
        postureScore: posture.score,
        complianceStatus: posture.complianceStatus,
        installedAppCount: dto.installedAppCount,
        highRiskPermissionCount: dto.highRiskPermissionCount,
        postureDetails: {
          ...(dto.postureDetails ?? {}),
          findings: posture.findings,
        } as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
        deletedAt: null,
      },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        deviceName: dto.deviceName,
        platform: dto.platform,
        manufacturer: dto.manufacturer,
        model: dto.model,
        osVersion: dto.osVersion,
        securityPatchLevel: dto.securityPatchLevel,
        appVersion: dto.appVersion,
        deviceIdentifier: dto.deviceIdentifier,
        isRootedOrCompromised: dto.isRootedOrCompromised ?? false,
        screenLockEnabled: dto.screenLockEnabled ?? true,
        biometricSupported: dto.biometricSupported ?? false,
        encryptionEnabled: dto.encryptionEnabled ?? true,
        postureScore: posture.score,
        complianceStatus: posture.complianceStatus,
        installedAppCount: dto.installedAppCount,
        highRiskPermissionCount: dto.highRiskPermissionCount,
        postureDetails: {
          ...(dto.postureDetails ?? {}),
          findings: posture.findings,
        } as Prisma.InputJsonValue,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: isNewDevice ? 'DEVICE_REGISTERED' : 'DEVICE_POSTURE_SYNCED',
      resourceType: 'Device',
      resourceId: saved.id,
      moduleCode: 'ENDPOINT_GUARDIAN',
      details: { complianceStatus: saved.complianceStatus, postureScore: saved.postureScore },
    });

    if (isNewDevice) {
      await this.notificationsService.createAndDispatch({
        organizationId: user.organizationId,
        userId: user.id,
        title: 'New Device Registered',
        message: `${saved.deviceName} (${saved.platform}) registered to SIS Cyber Fortress.`,
        severity: 'INFO',
        moduleCode: 'ENDPOINT_GUARDIAN',
        deepLink: '/devices',
        resourceType: 'Device',
        resourceId: saved.id,
      });

      await this.notificationsService.notifyOrgAdmins(user.organizationId, {
        title: 'New Endpoint Device Registered',
        message: `${user.email} registered ${saved.deviceName} (${saved.complianceStatus}).`,
        severity: saved.complianceStatus === 'NON_COMPLIANT' ? 'HIGH' : 'INFO',
        moduleCode: 'ENDPOINT_GUARDIAN',
        deepLink: '/devices',
        resourceType: 'Device',
        resourceId: saved.id,
      });
    }

    if (saved.complianceStatus === 'NON_COMPLIANT') {
      const mod = await this.prisma.securityModule.findUnique({
        where: { code: 'ENDPOINT_GUARDIAN' },
      });
      if (mod) {
        const alert = await this.prisma.securityAlert.create({
          data: {
            organizationId: user.organizationId,
            moduleId: mod.id,
            deviceId: saved.id,
            userId: user.id,
            title: `Non-Compliant Device Posture: ${saved.deviceName}`,
            description: posture.findings.join(' '),
            severity: 'HIGH',
            status: 'OPEN',
            category: 'ENDPOINT_COMPLIANCE',
            sourceRef: `device:${saved.id}`,
          },
        });
        this.socGateway.emitOrgSocEvent(user.organizationId, 'alert:created', alert);
      }
    }

    return saved;
  }

  async listDevices(user: AuthenticatedUser) {
    const where: Prisma.DeviceWhereInput = {
      organizationId: user.organizationId,
      deletedAt: null,
      ...(this.isPrivilegedViewer(user) ? {} : { userId: user.id }),
    };

    return this.prisma.device.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async getDevice(user: AuthenticatedUser, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, organizationId: user.organizationId, deletedAt: null },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (!device) throw new NotFoundException('Device not found.');
    if (!this.isPrivilegedViewer(user) && device.userId !== user.id) {
      throw new ForbiddenException('Access denied to another user device.');
    }
    return device;
  }

  async removeDevice(user: AuthenticatedUser, deviceId: string) {
    const device = await this.getDevice(user, deviceId);
    await this.prisma.device.update({
      where: { id: device.id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'DEVICE_REMOVED',
      resourceType: 'Device',
      resourceId: device.id,
      moduleCode: 'ENDPOINT_GUARDIAN',
    });

    return { removed: true, id: device.id };
  }
}
