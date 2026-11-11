import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateIndicatorDto } from './dto/threats.dto';

@Injectable()
export class ThreatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listSources(organizationId: string) {
    const sources = await this.prisma.threatSource.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });

    const integrations = await this.prisma.integrationStatus.findMany({
      where: {
        organizationId,
        serviceKey: { in: ['virustotal', 'google_safe_browsing'] },
      },
    });

    return { sources, externalFeeds: integrations };
  }

  async listIndicators(
    organizationId: string,
    query: { type?: string; severity?: string; search?: string; tag?: string },
  ) {
    const where: Prisma.ThreatIndicatorWhereInput = {
      organizationId,
      isActive: true,
      ...(query.type ? { indicatorType: query.type } : {}),
      ...(query.severity ? { severity: query.severity as Prisma.EnumSeverityLevelFilter } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.search
        ? {
            OR: [
              { value: { contains: query.search, mode: 'insensitive' } },
              { threatCategory: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.threatIndicator.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { updatedAt: 'desc' }],
      include: { source: { select: { id: true, name: true, providerKey: true, lastSyncedAt: true } } },
      take: 200,
    });
  }

  async createIndicator(user: AuthenticatedUser, dto: CreateIndicatorDto) {
    const providerKey = dto.sourceProviderKey || 'sis-local-ioc';
    const source = await this.prisma.threatSource.upsert({
      where: {
        organizationId_providerKey: { organizationId: user.organizationId, providerKey },
      },
      update: { lastSyncedAt: new Date() },
      create: {
        organizationId: user.organizationId,
        name: providerKey === 'sis-local-ioc' ? 'SIS Curated Baseline IOC Registry' : providerKey,
        providerKey,
        feedType: 'INTERNAL',
        status: 'ACTIVE',
        isConfigured: true,
        lastSyncedAt: new Date(),
      },
    });

    const value = dto.value.trim().toLowerCase();
    const saved = await this.prisma.threatIndicator.upsert({
      where: {
        organizationId_indicatorType_value: {
          organizationId: user.organizationId,
          indicatorType: dto.indicatorType,
          value,
        },
      },
      update: {
        threatCategory: dto.threatCategory,
        severity: dto.severity,
        confidence: dto.confidence ?? 80,
        tags: dto.tags ?? [],
        description: dto.description,
        lastSeenAt: new Date(),
        isActive: true,
      },
      create: {
        organizationId: user.organizationId,
        sourceId: source.id,
        indicatorType: dto.indicatorType,
        value,
        threatCategory: dto.threatCategory,
        severity: dto.severity,
        confidence: dto.confidence ?? 80,
        tags: dto.tags ?? [],
        description: dto.description,
      },
      include: { source: true },
    });

    const totalCount = await this.prisma.threatIndicator.count({
      where: { sourceId: source.id, isActive: true },
    });
    await this.prisma.threatSource.update({
      where: { id: source.id },
      data: { recordCount: totalCount, lastSyncedAt: new Date() },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'THREAT_IOC_UPSERTED',
      resourceType: 'ThreatIndicator',
      resourceId: saved.id,
      moduleCode: 'THREAT_INTELLIGENCE',
      details: { type: dto.indicatorType, value, severity: dto.severity },
    });

    return saved;
  }

  async deactivateIndicator(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.threatIndicator.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Threat indicator not found.');

    await this.prisma.threatIndicator.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'THREAT_IOC_ARCHIVED',
      resourceType: 'ThreatIndicator',
      resourceId: id,
      moduleCode: 'THREAT_INTELLIGENCE',
    });

    return { archived: true, id };
  }
}
