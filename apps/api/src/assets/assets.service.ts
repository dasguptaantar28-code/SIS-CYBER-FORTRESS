import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { resolveTxt } from 'node:dns/promises';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateSecureToken } from '../common/security/crypto.util';
import { validateSafeOutboundUrl } from '../common/security/ssrf.guard';
import { CreateAssetDto, VerifyAssetDto } from './dto/assets.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createAsset(user: AuthenticatedUser, dto: CreateAssetDto) {
    const validated = await validateSafeOutboundUrl(dto.targetUrl);
    const domain = validated.hostname;

    const existing = await this.prisma.registeredAsset.findUnique({
      where: {
        organizationId_domain: {
          organizationId: user.organizationId,
          domain,
        },
      },
    });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException(`Domain "${domain}" is already registered in this workspace.`);
    }

    const verificationToken = `sis-fortress-verify=${generateSecureToken(16)}`;

    const asset = existing
      ? await this.prisma.registeredAsset.update({
          where: { id: existing.id },
          data: {
            name: dto.name,
            assetType: dto.assetType ?? 'WEBSITE',
            targetUrl: validated.url.toString(),
            ownershipStatus: 'PENDING',
            verificationToken,
            verifiedAt: null,
            isApprovedForScan: false,
            notes: dto.notes,
            deletedAt: null,
            createdById: user.id,
          },
        })
      : await this.prisma.registeredAsset.create({
          data: {
            organizationId: user.organizationId,
            createdById: user.id,
            name: dto.name,
            assetType: dto.assetType ?? 'WEBSITE',
            targetUrl: validated.url.toString(),
            domain,
            ownershipStatus: 'PENDING',
            verificationToken,
            isApprovedForScan: false,
            notes: dto.notes,
          },
        });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'ASSET_REGISTERED',
      resourceType: 'RegisteredAsset',
      resourceId: asset.id,
      moduleCode: 'WEBSHIELD',
      details: { domain, targetUrl: asset.targetUrl },
    });

    return asset;
  }

  async listAssets(organizationId: string) {
    return this.prisma.registeredAsset.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        _count: { select: { scanJobs: true } },
      },
    });
  }

  async verifyAsset(user: AuthenticatedUser, assetId: string, dto: VerifyAssetDto) {
    const asset = await this.prisma.registeredAsset.findFirst({
      where: { id: assetId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Registered asset not found.');

    let verified = false;
    let verificationDetail = '';

    if (dto.method === 'ADMIN_APPROVAL') {
      const canApprove = user.roles.some((r) => ['SUPER_ADMIN', 'SECURITY_ADMIN'].includes(r));
      if (!canApprove) {
        throw new ForbiddenException(
          'Explicit admin scope approval requires SUPER_ADMIN or SECURITY_ADMIN role.',
        );
      }
      verified = true;
      verificationDetail = `Explicitly approved for authorized scanning by ${user.email}.`;
    } else if (dto.method === 'DNS_TXT') {
      try {
        const records = await resolveTxt(`_sis-verify.${asset.domain}`);
        const flat = records.flat();
        verified = flat.some((txt) => txt.includes(asset.verificationToken));
        verificationDetail = verified
          ? 'Verified via _sis-verify DNS TXT record.'
          : 'DNS TXT record did not contain the expected verification token.';
      } catch {
        verificationDetail = `DNS TXT lookup for _sis-verify.${asset.domain} failed or not published yet.`;
      }
    } else if (dto.method === 'WELL_KNOWN_HTTP') {
      const wellKnownUrl = new URL('/.well-known/sis-cyber-fortress.txt', asset.targetUrl).toString();
      await validateSafeOutboundUrl(wellKnownUrl);
      try {
        const res = await fetch(wellKnownUrl, {
          redirect: 'manual',
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const text = (await res.text()).slice(0, 2048);
          verified = text.includes(asset.verificationToken);
          verificationDetail = verified
            ? 'Verified via /.well-known/sis-cyber-fortress.txt.'
            : 'Well-known file fetched, but verification token did not match.';
        } else {
          verificationDetail = `Well-known endpoint returned HTTP ${res.status}.`;
        }
      } catch {
        verificationDetail = 'Could not reach /.well-known/sis-cyber-fortress.txt.';
      }
    }

    if (!verified) {
      throw new BadRequestException(verificationDetail || 'Asset ownership verification failed.');
    }

    const updated = await this.prisma.registeredAsset.update({
      where: { id: asset.id },
      data: {
        ownershipStatus: dto.method === 'ADMIN_APPROVAL' ? 'APPROVED' : 'VERIFIED',
        verificationMethod: dto.method,
        verifiedAt: new Date(),
        isApprovedForScan: dto.approveForScan ?? true,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'ASSET_VERIFIED',
      resourceType: 'RegisteredAsset',
      resourceId: asset.id,
      moduleCode: 'WEBSHIELD',
      details: { method: dto.method, detail: verificationDetail },
    });

    return { asset: updated, verificationDetail };
  }

  async deleteAsset(user: AuthenticatedUser, assetId: string) {
    const asset = await this.prisma.registeredAsset.findFirst({
      where: { id: assetId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found.');

    await this.prisma.registeredAsset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date(), isApprovedForScan: false },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'ASSET_DELETED',
      resourceType: 'RegisteredAsset',
      resourceId: asset.id,
      moduleCode: 'WEBSHIELD',
    });

    return { deleted: true, id: asset.id };
  }
}
