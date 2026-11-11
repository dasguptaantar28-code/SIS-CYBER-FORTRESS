import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { sha256Hex } from '../common/security/crypto.util';
import {
  AddEvidenceDto,
  CreateForensicCaseDto,
  CustodyEventDto,
  UpdateCaseStatusDto,
} from './dto/forensics.dto';

@Injectable()
export class ForensicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createCase(user: AuthenticatedUser, dto: CreateForensicCaseDto) {
    const count = await this.prisma.forensicCase.count({
      where: { organizationId: user.organizationId },
    });
    const caseNumber = `CASE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const created = await this.prisma.forensicCase.create({
      data: {
        organizationId: user.organizationId,
        caseNumber,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        status: 'OPEN',
        incidentId: dto.incidentId,
        leadInvestigatorId: dto.leadInvestigatorId ?? user.id,
        createdById: user.id,
      },
      include: {
        leadInvestigator: { select: { id: true, email: true, fullName: true } },
        createdBy: { select: { id: true, email: true, fullName: true } },
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'FORENSIC_CASE_CREATED',
      resourceType: 'ForensicCase',
      resourceId: created.id,
      moduleCode: 'DIGITAL_FORENSICS',
      details: { caseNumber, severity: dto.severity },
    });

    return created;
  }

  async listCases(organizationId: string) {
    return this.prisma.forensicCase.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        leadInvestigator: { select: { id: true, email: true, fullName: true } },
        incident: { select: { id: true, incidentNumber: true, title: true } },
        _count: { select: { evidenceItems: true } },
      },
    });
  }

  async getCaseDetail(organizationId: string, caseId: string) {
    const forensicCase = await this.prisma.forensicCase.findFirst({
      where: { id: caseId, organizationId, deletedAt: null },
      include: {
        leadInvestigator: { select: { id: true, email: true, fullName: true } },
        createdBy: { select: { id: true, email: true, fullName: true } },
        incident: true,
        evidenceItems: {
          orderBy: { collectedAt: 'asc' },
          include: {
            collectedBy: { select: { id: true, email: true, fullName: true } },
            custodyLogs: {
              orderBy: { timestamp: 'asc' },
              include: { actor: { select: { id: true, email: true, fullName: true } } },
            },
          },
        },
      },
    });
    if (!forensicCase) throw new NotFoundException('Forensic case not found.');
    return forensicCase;
  }

  async addEvidence(
    user: AuthenticatedUser,
    caseId: string,
    dto: AddEvidenceDto,
    ipAddress?: string,
  ) {
    const forensicCase = await this.prisma.forensicCase.findFirst({
      where: { id: caseId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!forensicCase) throw new NotFoundException('Forensic case not found.');

    const computedHash = dto.contentForHashing
      ? sha256Hex(dto.contentForHashing)
      : dto.sha256Hash?.toLowerCase();

    if (!computedHash || !/^[0-9a-f]{64}$/.test(computedHash)) {
      throw new BadRequestException(
        'Provide either contentForHashing or a valid 64-char SHA-256 hex hash.',
      );
    }

    const byteSize = dto.contentForHashing
      ? Buffer.byteLength(dto.contentForHashing, 'utf8')
      : dto.byteSize ?? 0;

    const evidence = await this.prisma.evidenceMetadata.create({
      data: {
        caseId: forensicCase.id,
        label: dto.label,
        evidenceType: dto.evidenceType,
        fileName: dto.fileName,
        byteSize,
        sha256Hash: computedHash,
        collectedById: user.id,
        storageLocation: dto.storageLocation,
        integrityVerified: true,
        notes: dto.notes,
        custodyLogs: {
          create: {
            actorId: user.id,
            action: 'COLLECTED',
            fromCustodian: 'SOURCE_SYSTEM',
            toCustodian: user.fullName,
            purpose: 'Initial forensic evidence intake and SHA-256 sealing.',
            integrityHashAtAction: computedHash,
            ipAddress,
          },
        },
      },
      include: { custodyLogs: true },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'FORENSIC_EVIDENCE_REGISTERED',
      resourceType: 'EvidenceMetadata',
      resourceId: evidence.id,
      moduleCode: 'DIGITAL_FORENSICS',
      ipAddress,
      details: { caseNumber: forensicCase.caseNumber, sha256Hash: computedHash },
    });

    return evidence;
  }

  async appendCustodyLog(
    user: AuthenticatedUser,
    evidenceId: string,
    dto: CustodyEventDto,
    ipAddress?: string,
  ) {
    const evidence = await this.prisma.evidenceMetadata.findFirst({
      where: {
        id: evidenceId,
        forensicCase: { organizationId: user.organizationId, deletedAt: null },
      },
      include: { forensicCase: true },
    });
    if (!evidence) throw new NotFoundException('Evidence item not found.');

    const observedHash = (dto.observedSha256 || evidence.sha256Hash).toLowerCase();
    const hashMatches = observedHash === evidence.sha256Hash;

    const [custodyEntry] = await this.prisma.$transaction([
      this.prisma.chainOfCustody.create({
        data: {
          evidenceId: evidence.id,
          actorId: user.id,
          action: dto.action,
          fromCustodian: dto.fromCustodian,
          toCustodian: dto.toCustodian,
          purpose: dto.purpose,
          integrityHashAtAction: observedHash,
          ipAddress,
        },
        include: { actor: { select: { id: true, email: true, fullName: true } } },
      }),
      // Never mutate original sha256Hash! Only flag integrityVerified false if mismatch detected.
      ...(hashMatches
        ? []
        : [
            this.prisma.evidenceMetadata.update({
              where: { id: evidence.id },
              data: { integrityVerified: false },
            }),
          ]),
    ]);

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'FORENSIC_CUSTODY_APPENDED',
      resourceType: 'EvidenceMetadata',
      resourceId: evidence.id,
      moduleCode: 'DIGITAL_FORENSICS',
      ipAddress,
      details: { action: dto.action, hashMatches },
    });

    return { custodyEntry, hashMatches };
  }

  async updateCaseStatus(user: AuthenticatedUser, caseId: string, dto: UpdateCaseStatusDto) {
    const existing = await this.prisma.forensicCase.findFirst({
      where: { id: caseId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Forensic case not found.');

    const updated = await this.prisma.forensicCase.update({
      where: { id: caseId },
      data: {
        status: dto.status,
        closedAt: dto.status === 'CLOSED' ? new Date() : existing.closedAt,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'FORENSIC_CASE_STATUS_UPDATED',
      resourceType: 'ForensicCase',
      resourceId: caseId,
      moduleCode: 'DIGITAL_FORENSICS',
      details: { previousStatus: existing.status, newStatus: dto.status },
    });

    return updated;
  }

  async exportCaseDossier(user: AuthenticatedUser, caseId: string, ipAddress?: string) {
    const detail = await this.getCaseDetail(user.organizationId, caseId);

    for (const item of detail.evidenceItems) {
      await this.prisma.chainOfCustody.create({
        data: {
          evidenceId: item.id,
          actorId: user.id,
          action: 'EXPORTED',
          fromCustodian: 'SIS_EVIDENCE_VAULT',
          toCustodian: user.email,
          purpose: 'Controlled forensic case dossier export.',
          integrityHashAtAction: item.sha256Hash,
          ipAddress,
        },
      });
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'FORENSIC_DOSSIER_EXPORTED',
      resourceType: 'ForensicCase',
      resourceId: detail.id,
      moduleCode: 'DIGITAL_FORENSICS',
      ipAddress,
      details: { caseNumber: detail.caseNumber, evidenceCount: detail.evidenceItems.length },
    });

    return {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      case: detail,
    };
  }
}
