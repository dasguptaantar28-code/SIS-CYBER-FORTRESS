import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface RecordAuditParams {
  organizationId: string;
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  moduleCode?: string;
  status?: 'SUCCESS' | 'DENIED' | 'FAILURE';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          actorUserId: params.actorUserId,
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          moduleCode: params.moduleCode,
          status: params.status ?? 'SUCCESS',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          details: (params.details ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Never crash primary request if audit write encounters transient failure,
      // though production log sinks should monitor DB health.
    }
  }

  async listLogs(
    organizationId: string,
    query: {
      moduleCode?: string;
      action?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(query.moduleCode ? { moduleCode: query.moduleCode } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { actorEmail: { contains: query.search, mode: 'insensitive' } },
              { action: { contains: query.search, mode: 'insensitive' } },
              { resourceType: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
