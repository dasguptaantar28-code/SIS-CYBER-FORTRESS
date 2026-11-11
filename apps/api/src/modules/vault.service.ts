import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { hashSecretArgon2id, verifySecretArgon2id } from '../common/security/crypto.util';

export interface CreateVaultRecordInput {
  recordType: 'PASSWORD' | 'SECURE_NOTE' | 'DOCUMENT';
  encryptedTitle: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  salt: string;
  kdfAlgorithm?: string;
  kdfIterations?: number;
  keyVersion?: number;
  clientType?: string;
}

export interface SaveRecoveryKitInput {
  recoveryCode: string;
  encryptedMasterWrap: string;
  iv: string;
  authTag: string;
  salt: string;
}

@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listOwnRecords(user: AuthenticatedUser, ipAddress?: string) {
    // Strictly user-owned zero-knowledge records; Super Admin cannot query other users' vault records
    const records = await this.prisma.vaultRecord.findMany({
      where: { userId: user.id, organizationId: user.organizationId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    await this.prisma.vaultActivity.create({
      data: {
        userId: user.id,
        action: 'VAULT_SYNCED',
        clientType: 'api',
        success: true,
        ipAddress,
      },
    });

    return records;
  }

  async createRecord(user: AuthenticatedUser, input: CreateVaultRecordInput, ipAddress?: string) {
    if (!input.ciphertext || !input.iv || !input.authTag || !input.salt || !input.encryptedTitle) {
      throw new BadRequestException(
        'Vault Guardian requires client-side AES-256-GCM encrypted payload fields (never plaintext).',
      );
    }

    const record = await this.prisma.vaultRecord.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        recordType: input.recordType,
        encryptedTitle: input.encryptedTitle,
        ciphertext: input.ciphertext,
        iv: input.iv,
        authTag: input.authTag,
        salt: input.salt,
        kdfAlgorithm: input.kdfAlgorithm ?? 'PBKDF2-SHA256',
        kdfIterations: input.kdfIterations ?? 600000,
        keyVersion: input.keyVersion ?? 1,
      },
    });

    await this.prisma.vaultActivity.create({
      data: {
        userId: user.id,
        recordId: record.id,
        action: 'VAULT_ITEM_CREATED',
        clientType: input.clientType ?? 'web',
        success: true,
        ipAddress,
      },
    });

    // Notice: audit log records ONLY action metadata, NEVER vault plaintext or ciphertext
    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'VAULT_ITEM_CREATED',
      resourceType: 'VaultRecord',
      resourceId: record.id,
      moduleCode: 'VAULT_GUARDIAN',
      details: { recordType: input.recordType, encryption: 'CLIENT_SIDE_AES_256_GCM' },
    });

    return record;
  }

  async deleteOwnRecord(user: AuthenticatedUser, recordId: string, ipAddress?: string) {
    const existing = await this.prisma.vaultRecord.findUnique({ where: { id: recordId } });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException('Vault record not found.');
    }
    if (existing.userId !== user.id) {
      throw new ForbiddenException('Vault records are strictly zero-knowledge user-isolated.');
    }

    await this.prisma.vaultRecord.update({
      where: { id: recordId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.vaultActivity.create({
      data: {
        userId: user.id,
        recordId,
        action: 'VAULT_ITEM_DELETED',
        clientType: 'api',
        success: true,
        ipAddress,
      },
    });

    return { deleted: true, id: recordId };
  }

  async getActivities(userId: string) {
    return this.prisma.vaultActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async saveRecoveryKit(user: AuthenticatedUser, input: SaveRecoveryKitInput) {
    const recoveryCodeHash = await hashSecretArgon2id(input.recoveryCode);
    const kit = await this.prisma.vaultRecoveryKit.upsert({
      where: { userId: user.id },
      update: {
        recoveryCodeHash,
        encryptedMasterWrap: input.encryptedMasterWrap,
        iv: input.iv,
        authTag: input.authTag,
        salt: input.salt,
        rotatedAt: new Date(),
      },
      create: {
        userId: user.id,
        recoveryCodeHash,
        encryptedMasterWrap: input.encryptedMasterWrap,
        iv: input.iv,
        authTag: input.authTag,
        salt: input.salt,
      },
      select: { id: true, createdAt: true, rotatedAt: true },
    });

    await this.prisma.vaultActivity.create({
      data: {
        userId: user.id,
        action: 'VAULT_RECOVERY_KIT_CONFIGURED',
        clientType: 'api',
        success: true,
      },
    });

    return kit;
  }

  async recoverMasterWrap(userId: string, recoveryCode: string) {
    const kit = await this.prisma.vaultRecoveryKit.findUnique({ where: { userId } });
    if (!kit) throw new NotFoundException('No vault recovery kit configured.');

    const valid = await verifySecretArgon2id(kit.recoveryCodeHash, recoveryCode);
    await this.prisma.vaultActivity.create({
      data: {
        userId,
        action: 'VAULT_RECOVERY_ATTEMPT',
        clientType: 'api',
        success: valid,
      },
    });

    if (!valid) {
      throw new ForbiddenException('Invalid vault recovery code.');
    }

    return {
      encryptedMasterWrap: kit.encryptedMasterWrap,
      iv: kit.iv,
      authTag: kit.authTag,
      salt: kit.salt,
    };
  }
}
