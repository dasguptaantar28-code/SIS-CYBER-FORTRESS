import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocEventsGateway } from '../notifications/soc-events.gateway';
import { AssignIncidentDto, CreateIncidentDto, UpdateIncidentStatusDto } from './dto/incidents.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly socGateway: SocEventsGateway,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateIncidentDto) {
    const count = await this.prisma.incident.count({ where: { organizationId: user.organizationId } });
    const incidentNumber = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const incident = await this.prisma.incident.create({
      data: {
        organizationId: user.organizationId,
        incidentNumber,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        status: 'OPEN',
        priority: dto.priority ?? (dto.severity === 'CRITICAL' ? 1 : dto.severity === 'HIGH' ? 2 : 3),
        sourceModuleCode: dto.sourceModuleCode ?? 'CYBER_SOC',
        createdById: user.id,
        ...(dto.alertIds?.length
          ? {
              alertLinks: {
                create: dto.alertIds.map((alertId) => ({ alertId })),
              },
            }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        assignments: { include: { assignee: { select: { id: true, email: true, fullName: true } } } },
        alertLinks: { include: { alert: true } },
      },
    });

    this.socGateway.emitOrgSocEvent(user.organizationId, 'incident:created', incident);

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'INCIDENT_CREATED',
      resourceType: 'Incident',
      resourceId: incident.id,
      moduleCode: 'CYBER_SOC',
      details: { incidentNumber, severity: dto.severity },
    });

    return incident;
  }

  async list(organizationId: string, query: { status?: string; severity?: string }) {
    const where: Prisma.IncidentWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status as Prisma.EnumIncidentStatusFilter } : {}),
      ...(query.severity ? { severity: query.severity as Prisma.EnumSeverityLevelFilter } : {}),
    };

    return this.prisma.incident.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        assignments: { include: { assignee: { select: { id: true, email: true, fullName: true } } } },
        _count: { select: { alertLinks: true, forensicCases: true } },
      },
    });
  }

  async updateStatus(user: AuthenticatedUser, incidentId: string, dto: UpdateIncidentStatusDto) {
    const existing = await this.prisma.incident.findFirst({
      where: { id: incidentId, organizationId: user.organizationId },
      include: { assignments: true },
    });
    if (!existing) throw new NotFoundException('Incident not found.');

    const now = new Date();
    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: dto.status,
        containedAt: dto.status === 'CONTAINED' ? now : existing.containedAt,
        resolvedAt: dto.status === 'RESOLVED' ? now : existing.resolvedAt,
        closedAt: dto.status === 'CLOSED' ? now : existing.closedAt,
      },
    });

    this.socGateway.emitOrgSocEvent(user.organizationId, 'incident:updated', updated);

    for (const assignment of existing.assignments) {
      await this.notificationsService.createAndDispatch({
        organizationId: user.organizationId,
        userId: assignment.assigneeId,
        title: `Incident ${existing.incidentNumber} Updated`,
        message: `Status changed from ${existing.status} to ${dto.status}.`,
        severity: existing.severity,
        moduleCode: 'CYBER_SOC',
        deepLink: '/incidents',
        resourceType: 'Incident',
        resourceId: incidentId,
      });
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'INCIDENT_STATUS_UPDATED',
      resourceType: 'Incident',
      resourceId: incidentId,
      moduleCode: 'CYBER_SOC',
      details: { previousStatus: existing.status, newStatus: dto.status },
    });

    return updated;
  }

  async assign(user: AuthenticatedUser, incidentId: string, dto: AssignIncidentDto) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organizationId: user.organizationId },
    });
    if (!incident) throw new NotFoundException('Incident not found.');

    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assigneeId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!assignee) throw new NotFoundException('Assignee user not found.');

    const assignment = await this.prisma.incidentAssignment.upsert({
      where: { incidentId_assigneeId: { incidentId, assigneeId: dto.assigneeId } },
      update: { assignedById: user.id, notes: dto.notes, assignedAt: new Date() },
      create: {
        incidentId,
        assigneeId: dto.assigneeId,
        assignedById: user.id,
        notes: dto.notes,
      },
      include: { assignee: { select: { id: true, email: true, fullName: true } } },
    });

    await this.notificationsService.createAndDispatch({
      organizationId: user.organizationId,
      userId: dto.assigneeId,
      title: `Assigned Incident ${incident.incidentNumber}`,
      message: `${incident.title} (${incident.severity}) was assigned to you.`,
      severity: incident.severity,
      moduleCode: 'CYBER_SOC',
      deepLink: '/incidents',
      resourceType: 'Incident',
      resourceId: incidentId,
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'INCIDENT_ASSIGNED',
      resourceType: 'Incident',
      resourceId: incidentId,
      moduleCode: 'CYBER_SOC',
      details: { assigneeEmail: assignee.email },
    });

    return assignment;
  }
}
