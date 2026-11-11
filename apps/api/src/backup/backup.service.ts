import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { decryptAes256Gcm, encryptAes256Gcm, sha256Hex } from '../common/security/crypto.util';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBackupJobDto } from './dto/backup.dto';

interface EncryptedBackupArchive {
  jobId: string;
  createdAt: string;
  files: Array<{
    relativePath: string;
    originalBytes: number;
    sha256Hash: string;
    ciphertext: string;
    iv: string;
    authTag: string;
  }>;
}

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getBackupDir(): string {
    const dir = resolve(
      process.cwd(),
      this.configService.get<string>('BACKUP_STORAGE_DIR') || './storage/backups',
    );
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private getEnvelopeKey(): string {
    return (
      this.configService.get<string>('BACKUP_MASTER_ENVELOPE_KEY') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'dev-backup-envelope-key'
    );
  }

  private isPrivilegedViewer(user: AuthenticatedUser): boolean {
    return user.roles.some((r) =>
      ['SUPER_ADMIN', 'SECURITY_ADMIN', 'MODULE_ADMIN', 'AUDITOR'].includes(r),
    );
  }

  async createEncryptedBackup(user: AuthenticatedUser, dto: CreateBackupJobDto) {
    const retentionDays = dto.retentionDays ?? 30;
    const expiresAt = new Date(Date.now() + retentionDays * 86_400_000);

    const job = await this.prisma.backupJob.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        backupName: dto.backupName,
        scheduleType: dto.scheduleType ?? 'MANUAL',
        status: 'IN_PROGRESS',
        encryptionAlgo: 'AES-256-GCM',
        expiresAt,
      },
    });

    try {
      const storageKey = `${job.id}.sisbak.json`;
      const storagePath = join(this.getBackupDir(), storageKey);
      const keyMaterial = `${this.getEnvelopeKey()}:${user.organizationId}`;

      let totalBytes = 0;
      const encryptedFiles: EncryptedBackupArchive['files'] = [];

      for (const entry of dto.entries) {
        const buf = Buffer.from(entry.content, 'utf8');
        const originalHash = sha256Hex(buf);
        const envelope = encryptAes256Gcm(buf, keyMaterial);
        totalBytes += buf.length;

        encryptedFiles.push({
          relativePath: entry.relativePath.replace(/^(\.\.(\/|\\|$))+/, ''),
          originalBytes: buf.length,
          sha256Hash: originalHash,
          ciphertext: envelope.ciphertext,
          iv: envelope.iv,
          authTag: envelope.authTag,
        });
      }

      const archive: EncryptedBackupArchive = {
        jobId: job.id,
        createdAt: new Date().toISOString(),
        files: encryptedFiles,
      };
      const serialized = JSON.stringify(archive);
      writeFileSync(storagePath, serialized, 'utf8');

      // Real round-trip integrity verification before ever reporting VERIFIED_SUCCESS
      const writtenRaw = readFileSync(storagePath, 'utf8');
      const parsed = JSON.parse(writtenRaw) as EncryptedBackupArchive;
      for (const f of parsed.files) {
        const decrypted = decryptAes256Gcm(
          { ciphertext: f.ciphertext, iv: f.iv, authTag: f.authTag },
          keyMaterial,
        );
        if (sha256Hex(decrypted) !== f.sha256Hash) {
          throw new Error(`Integrity verification mismatch on ${f.relativePath}`);
        }
      }

      const archiveChecksum = sha256Hex(writtenRaw);

      const completed = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'VERIFIED_SUCCESS',
          totalBytes,
          fileCount: encryptedFiles.length,
          storageKey,
          integrityVerified: true,
          checksumSha256: archiveChecksum,
          completedAt: new Date(),
          files: {
            create: encryptedFiles.map((f) => ({
              relativePath: f.relativePath,
              originalBytes: f.originalBytes,
              encryptedBytes: Buffer.byteLength(f.ciphertext, 'base64'),
              sha256Hash: f.sha256Hash,
              iv: f.iv,
              authTag: f.authTag,
            })),
          },
        },
        include: { files: true },
      });

      await this.auditService.record({
        organizationId: user.organizationId,
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'BACKUP_CREATED_AND_VERIFIED',
        resourceType: 'BackupJob',
        resourceId: job.id,
        moduleCode: 'CLOUD_BACKUP',
        details: { totalBytes, fileCount: encryptedFiles.length, checksumSha256: archiveChecksum },
      });

      await this.notificationsService.createAndDispatch({
        organizationId: user.organizationId,
        userId: user.id,
        title: 'Encrypted Backup Verified',
        message: `Backup "${dto.backupName}" (${encryptedFiles.length} file(s)) encrypted and verified via SHA-256.`,
        severity: 'INFO',
        moduleCode: 'CLOUD_BACKUP',
        deepLink: '/modules/cloud-backup',
        resourceType: 'BackupJob',
        resourceId: job.id,
      });

      return completed;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Backup verification failed.';
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          integrityVerified: false,
          errorMessage,
          completedAt: new Date(),
        },
      });

      await this.notificationsService.createAndDispatch({
        organizationId: user.organizationId,
        userId: user.id,
        title: 'Encrypted Backup Failed',
        message: `Backup "${dto.backupName}" failed: ${errorMessage}`,
        severity: 'HIGH',
        moduleCode: 'CLOUD_BACKUP',
        deepLink: '/modules/cloud-backup',
        resourceType: 'BackupJob',
        resourceId: job.id,
      });

      throw new InternalServerErrorException(`Backup failed verification: ${errorMessage}`);
    }
  }

  async listBackups(user: AuthenticatedUser) {
    const jobs = await this.prisma.backupJob.findMany({
      where: {
        organizationId: user.organizationId,
        ...(this.isPrivilegedViewer(user) ? {} : { userId: user.id }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        files: {
          select: {
            id: true,
            relativePath: true,
            originalBytes: true,
            encryptedBytes: true,
            sha256Hash: true,
          },
        },
      },
      take: 100,
    });

    const totalStorageBytes = jobs.reduce((acc, j) => acc + j.totalBytes, 0);
    const verifiedCount = jobs.filter((j) => j.status === 'VERIFIED_SUCCESS' || j.status === 'RESTORED').length;

    return {
      jobs,
      summary: {
        totalJobs: jobs.length,
        verifiedCount,
        failedCount: jobs.filter((j) => j.status === 'FAILED').length,
        totalStorageBytes,
      },
    };
  }

  async verifyAndRestoreBackup(user: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.backupJob.findFirst({
      where: { id: jobId, organizationId: user.organizationId },
      include: { files: true },
    });
    if (!job || !job.storageKey) {
      throw new NotFoundException('Backup job or archive not found.');
    }
    if (job.userId !== user.id && !user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only backup owner or Super Admin can initiate restore verification.');
    }

    const storagePath = join(this.getBackupDir(), job.storageKey);
    const raw = readFileSync(storagePath, 'utf8');
    const currentArchiveHash = sha256Hex(raw);
    if (job.checksumSha256 && currentArchiveHash !== job.checksumSha256) {
      throw new InternalServerErrorException('Archive SHA-256 tamper check failed!');
    }

    const parsed = JSON.parse(raw) as EncryptedBackupArchive;
    const keyMaterial = `${this.getEnvelopeKey()}:${user.organizationId}`;
    const restoredFiles = parsed.files.map((f) => {
      const plain = decryptAes256Gcm(
        { ciphertext: f.ciphertext, iv: f.iv, authTag: f.authTag },
        keyMaterial,
      );
      const actualHash = sha256Hex(plain);
      if (actualHash !== f.sha256Hash) {
        throw new InternalServerErrorException(`File integrity failure on ${f.relativePath}`);
      }
      return {
        relativePath: f.relativePath,
        sha256Hash: actualHash,
        byteLength: plain.length,
        content: plain.toString('utf8'),
      };
    });

    await this.prisma.backupJob.update({
      where: { id: job.id },
      data: { status: 'RESTORED', integrityVerified: true },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'BACKUP_VERIFIED_AND_RESTORED',
      resourceType: 'BackupJob',
      resourceId: job.id,
      moduleCode: 'CLOUD_BACKUP',
      details: { fileCount: restoredFiles.length, archiveChecksum: currentArchiveHash },
    });

    return {
      jobId: job.id,
      backupName: job.backupName,
      integrityVerified: true,
      restoredAt: new Date().toISOString(),
      files: restoredFiles,
    };
  }
}
