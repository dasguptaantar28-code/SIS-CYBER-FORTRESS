import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { escapeCsvCell } from '../common/security/crypto.util';

export type ReportCategory =
  | 'module-status'
  | 'incidents'
  | 'threat-activity'
  | 'device-security'
  | 'website-scans'
  | 'backup-performance'
  | 'forensic-cases'
  | 'admin-activity';

export interface ReportPayload {
  title: string;
  category: ReportCategory;
  generatedAt: string;
  dateRange: { from: string; to: string };
  source: string;
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateReportData(
    user: AuthenticatedUser,
    category: ReportCategory,
    fromStr?: string,
    toStr?: string,
  ): Promise<ReportPayload> {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range parameters.');
    }

    const orgId = user.organizationId;
    const base = {
      category,
      generatedAt: new Date().toISOString(),
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      source: 'SIS Cyber Fortress PostgreSQL Authoritative Store',
    };

    switch (category) {
      case 'module-status': {
        const mods = await this.prisma.securityModule.findMany({
          orderBy: { number: 'asc' },
          include: { statuses: { where: { organizationId: orgId } } },
        });
        return {
          ...base,
          title: 'Module Security Health & Status Report',
          columns: ['Number', 'Code', 'Module Name', 'Category', 'Enabled', 'Health', 'Posture Score'],
          rows: mods.map((m) => [
            m.number,
            m.code,
            m.name,
            m.category,
            m.isEnabled ? 'YES' : 'NO',
            m.statuses[0]?.healthStatus ?? 'HEALTHY',
            m.statuses[0]?.postureScore ?? 100,
          ]),
        };
      }

      case 'incidents': {
        const incidents = await this.prisma.incident.findMany({
          where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
        });
        return {
          ...base,
          title: 'Cyber SOC Security Incidents Report',
          columns: ['Incident #', 'Title', 'Severity', 'Status', 'Priority', 'Module', 'Created At'],
          rows: incidents.map((i) => [
            i.incidentNumber,
            i.title,
            i.severity,
            i.status,
            i.priority,
            i.sourceModuleCode ?? 'CYBER_SOC',
            i.createdAt.toISOString(),
          ]),
        };
      }

      case 'threat-activity': {
        const alerts = await this.prisma.securityAlert.findMany({
          where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
          include: { module: { select: { shortName: true } } },
        });
        return {
          ...base,
          title: 'Threat & Security Alert Activity Report',
          columns: ['Timestamp', 'Module', 'Title', 'Category', 'Severity', 'Status'],
          rows: alerts.map((a) => [
            a.createdAt.toISOString(),
            a.module.shortName,
            a.title,
            a.category,
            a.severity,
            a.status,
          ]),
        };
      }

      case 'device-security': {
        const devices = await this.prisma.device.findMany({
          where: { organizationId: orgId, deletedAt: null },
          orderBy: { lastSeenAt: 'desc' },
          include: { user: { select: { email: true } } },
        });
        return {
          ...base,
          title: 'Endpoint & Device Security Posture Report',
          columns: ['Device', 'Owner', 'Platform', 'OS Version', 'Compliance', 'Score', 'Last Seen'],
          rows: devices.map((d) => [
            d.deviceName,
            d.user.email,
            d.platform,
            d.osVersion ?? 'Unknown',
            d.complianceStatus,
            d.postureScore,
            d.lastSeenAt.toISOString(),
          ]),
        };
      }

      case 'website-scans': {
        const scans = await this.prisma.scanJob.findMany({
          where: { organizationId: orgId, moduleCode: 'WEBSHIELD', createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
          include: { result: true },
        });
        return {
          ...base,
          title: 'WebShield Authorized Website Security Scan Report',
          columns: ['Target URL', 'Status', 'Risk Level', 'Risk Score', 'Summary', 'Scanned At'],
          rows: scans.map((s) => [
            s.targetValue,
            s.status,
            s.result?.riskLevel ?? 'N/A',
            s.result?.riskScore ?? 0,
            s.result?.summary ?? '',
            s.createdAt.toISOString(),
          ]),
        };
      }

      case 'backup-performance': {
        const backups = await this.prisma.backupJob.findMany({
          where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
        });
        return {
          ...base,
          title: 'Cloud Backup Guardian Performance & Integrity Report',
          columns: ['Backup Name', 'Status', 'Algo', 'Files', 'Bytes', 'Verified', 'Created At'],
          rows: backups.map((b) => [
            b.backupName,
            b.status,
            b.encryptionAlgo,
            b.fileCount,
            b.totalBytes,
            b.integrityVerified ? 'YES' : 'NO',
            b.createdAt.toISOString(),
          ]),
        };
      }

      case 'forensic-cases': {
        const cases = await this.prisma.forensicCase.findMany({
          where: { organizationId: orgId, deletedAt: null, createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { evidenceItems: true } } },
        });
        return {
          ...base,
          title: 'Digital Forensics Case History Report',
          columns: ['Case #', 'Title', 'Severity', 'Status', 'Evidence Items', 'Created At'],
          rows: cases.map((c) => [
            c.caseNumber,
            c.title,
            c.severity,
            c.status,
            c._count.evidenceItems,
            c.createdAt.toISOString(),
          ]),
        };
      }

      case 'admin-activity': {
        const logs = await this.prisma.auditLog.findMany({
          where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        return {
          ...base,
          title: 'Administrative & Security Audit Activity Report',
          columns: ['Timestamp', 'Actor', 'Action', 'Resource', 'Module', 'Status', 'IP'],
          rows: logs.map((l) => [
            l.createdAt.toISOString(),
            l.actorEmail ?? 'SYSTEM',
            l.action,
            l.resourceType,
            l.moduleCode ?? 'CORE',
            l.status,
            l.ipAddress ?? '',
          ]),
        };
      }

      default:
        throw new BadRequestException(`Unsupported report category: ${category}`);
    }
  }

  async exportCsv(
    user: AuthenticatedUser,
    category: ReportCategory,
    fromStr?: string,
    toStr?: string,
  ): Promise<{ filename: string; content: string }> {
    const report = await this.generateReportData(user, category, fromStr, toStr);
    const metaLines = [
      `# Title: ${report.title}`,
      `# Generated At: ${report.generatedAt}`,
      `# Date Range: ${report.dateRange.from} to ${report.dateRange.to}`,
      `# Source: ${report.source}`,
      `# Exported By: ${user.email}`,
    ];
    const headerLine = report.columns.map(escapeCsvCell).join(',');
    const bodyLines = report.rows.map((r) => r.map(escapeCsvCell).join(','));

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'REPORT_EXPORTED_CSV',
      resourceType: 'Report',
      moduleCode: 'CYBER_SOC',
      details: { category, rowCount: report.rows.length },
    });

    return {
      filename: `sis-${category}-${new Date().toISOString().slice(0, 10)}.csv`,
      content: [...metaLines, headerLine, ...bodyLines].join('\r\n'),
    };
  }

  async exportPdf(
    user: AuthenticatedUser,
    category: ReportCategory,
    fromStr?: string,
    toStr?: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.generateReportData(user, category, fromStr, toStr);

    const buffer = await new Promise<Buffer>((resolvePdf, rejectPdf) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
      doc.on('error', rejectPdf);

      doc.fillColor('#087BFF').fontSize(18).text('SIS CYBER FORTRESS', { align: 'left' });
      doc.fillColor('#334155').fontSize(10).text('12-in-1 Enterprise Cybersecurity Ecosystem');
      doc.moveDown(0.5);
      doc.fillColor('#0F172A').fontSize(14).text(report.title);
      doc.fontSize(9).fillColor('#475569');
      doc.text(`Generated At: ${report.generatedAt}`);
      doc.text(`Date Range: ${report.dateRange.from} to ${report.dateRange.to}`);
      doc.text(`Source: ${report.source}`);
      doc.text(`Requested By: ${user.email}`);
      doc.moveDown(1);

      if (report.rows.length === 0) {
        doc.fontSize(11).fillColor('#64748B').text('No persisted records matched the selected date range.');
      } else {
        doc.fontSize(9).fillColor('#0F172A').text(report.columns.join('  |  '));
        doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke('#CBD5E1');
        doc.moveDown(0.4);

        for (const row of report.rows.slice(0, 150)) {
          doc
            .fontSize(8)
            .fillColor('#1E293B')
            .text(row.map((c) => String(c ?? '')).join('  |  '), { width: 515 });
          doc.moveDown(0.2);
        }
      }

      doc.end();
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'REPORT_EXPORTED_PDF',
      resourceType: 'Report',
      moduleCode: 'CYBER_SOC',
      details: { category, rowCount: report.rows.length },
    });

    return {
      filename: `sis-${category}-${new Date().toISOString().slice(0, 10)}.pdf`,
      buffer,
    };
  }
}
