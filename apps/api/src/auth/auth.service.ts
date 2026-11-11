import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  decryptAes256Gcm,
  encryptAes256Gcm,
  generateSecureToken,
  hashSecretArgon2id,
  sha256Hex,
  verifySecretArgon2id,
} from '../common/security/crypto.util';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BreachPrefixCheckDto,
  ConfirmPasswordResetDto,
  LoginDto,
  MfaVerifyLoginDto,
  RegisterDto,
  RegisterPasskeyDto,
  RequestPasswordResetDto,
} from './dto/auth.dto';

export interface ClientRequestMeta {
  ipAddress?: string;
  userAgent?: string;
  clientPlatformHeader?: string;
}

interface MfaChallengePayload {
  sub: string;
  orgId: string;
  type: 'mfa_challenge';
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getWrappingKey(): string {
    return (
      this.configService.get<string>('BACKUP_MASTER_ENVELOPE_KEY') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'dev-fallback-wrapping-key'
    );
  }

  async register(dto: RegisterDto, meta: ClientRequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const org = await this.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!org) {
      throw new BadRequestException('Organization workspace has not been initialized.');
    }

    const regularRole = await this.prisma.role.findUnique({ where: { code: 'REGULAR_USER' } });
    if (!regularRole) {
      throw new BadRequestException('Default user role is not initialized.');
    }

    const passwordHash = await hashSecretArgon2id(dto.password);

    const user = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        fullName: dto.fullName.trim(),
        passwordHash,
        status: 'ACTIVE',
        roles: {
          create: {
            roleId: regularRole.id,
          },
        },
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: 'REGULAR_USER',
      action: 'USER_REGISTERED',
      resourceType: 'User',
      resourceId: user.id,
      moduleCode: 'IDENTITY_GUARDIAN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const sessionResult = await this.createUserSession(
      user.id,
      dto.clientType ?? (meta.clientPlatformHeader === 'android' ? 'android' : 'web'),
      dto.deviceName ?? (meta.userAgent?.slice(0, 80) || 'Browser Client'),
      meta.ipAddress,
      meta.userAgent,
    );

    return sessionResult;
  }

  async login(dto: LoginDto, meta: ClientRequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    const fallbackOrg = user
      ? null
      : await this.prisma.organization.findFirst({ select: { id: true } });

    if (!user || user.deletedAt !== null) {
      if (fallbackOrg) {
        await this.prisma.loginActivity.create({
          data: {
            organizationId: fallbackOrg.id,
            emailAttempted: email,
            success: false,
            failureReason: 'INVALID_CREDENTIALS',
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            isSuspicious: false,
          },
        });
      }
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Account is currently ${user.status.toLowerCase()}.`);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.prisma.loginActivity.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          emailAttempted: email,
          success: false,
          failureReason: 'ACCOUNT_LOCKED',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          isSuspicious: true,
        },
      });
      throw new ForbiddenException(
        'Account temporarily locked due to repeated failed sign-in attempts. Try again later.',
      );
    }

    const passwordValid = await verifySecretArgon2id(user.passwordHash, dto.password);
    if (!passwordValid) {
      const nextCount = user.failedLoginCount + 1;
      const shouldLock = nextCount >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: nextCount,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
        },
      });

      const isSuspicious = nextCount >= 3;
      await this.prisma.loginActivity.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          emailAttempted: email,
          success: false,
          failureReason: shouldLock ? 'LOCKOUT_TRIGGERED' : 'INVALID_PASSWORD',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          isSuspicious,
        },
      });

      if (isSuspicious) {
        await this.raiseSuspiciousLoginAlert(
          user.organizationId,
          user.id,
          user.email,
          `Repeated failed login attempts (${nextCount}) detected from ${meta.ipAddress || 'unknown IP'}.`,
        );
      }

      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check if IP/User-Agent differs from previous successful logins (suspicious sign-in awareness)
    const priorSuccess = await this.prisma.loginActivity.findFirst({
      where: { userId: user.id, success: true },
      orderBy: { createdAt: 'desc' },
    });
    const isNewSource =
      Boolean(priorSuccess) &&
      Boolean(meta.ipAddress) &&
      priorSuccess!.ipAddress !== null &&
      priorSuccess!.ipAddress !== meta.ipAddress;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    if (user.mfaEnabled && user.mfaSecretEnc) {
      const challengeToken = await this.jwtService.signAsync(
        { sub: user.id, orgId: user.organizationId, type: 'mfa_challenge' } satisfies MfaChallengePayload,
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: '5m',
        },
      );
      return {
        mfaRequired: true,
        challengeToken,
        message: 'Multi-factor authentication verification code required.',
      };
    }

    await this.prisma.loginActivity.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        emailAttempted: email,
        success: true,
        mfaUsed: false,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        isSuspicious: isNewSource,
      },
    });

    if (isNewSource) {
      await this.raiseSuspiciousLoginAlert(
        user.organizationId,
        user.id,
        user.email,
        `Sign-in from new IP address (${meta.ipAddress}) for ${user.email}.`,
      );
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.roles.map((r) => r.role.code).join(','),
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'UserSession',
      moduleCode: 'IDENTITY_GUARDIAN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { mfaUsed: false, newSourceIp: isNewSource },
    });

    return this.createUserSession(
      user.id,
      dto.clientType ?? (meta.clientPlatformHeader === 'android' ? 'android' : 'web'),
      dto.deviceName ?? (meta.userAgent?.slice(0, 80) || 'Browser Client'),
      meta.ipAddress,
      meta.userAgent,
      dto.fcmToken,
    );
  }

  async verifyMfaLogin(dto: MfaVerifyLoginDto, meta: ClientRequestMeta) {
    let payload: MfaChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<MfaChallengePayload>(dto.challengeToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('MFA challenge token is invalid or expired.');
    }

    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException('Invalid MFA challenge token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.mfaEnabled || !user.mfaSecretEnc) {
      throw new UnauthorizedException('MFA is not configured for this account.');
    }

    const secretBase32 = this.decryptMfaSecret(user.mfaSecretEnc);
    if (!this.verifyTotp(secretBase32, user.email, dto.code)) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    await this.prisma.loginActivity.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        emailAttempted: user.email,
        success: true,
        mfaUsed: true,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        isSuspicious: false,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.roles.map((r) => r.role.code).join(','),
      action: 'AUTH_MFA_LOGIN_SUCCESS',
      resourceType: 'UserSession',
      moduleCode: 'IDENTITY_GUARDIAN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.createUserSession(
      user.id,
      dto.clientType ?? (meta.clientPlatformHeader === 'android' ? 'android' : 'web'),
      dto.deviceName ?? (meta.userAgent?.slice(0, 80) || 'Browser Client'),
      meta.ipAddress,
      meta.userAgent,
      dto.fcmToken,
    );
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'SIS Cyber Fortress',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const envelope = encryptAes256Gcm(secret.base32, this.getWrappingKey());
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecretEnc: JSON.stringify(envelope) },
    });

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      otpauthUrl,
      qrCodeDataUrl,
      manualEntryKey: secret.base32,
      mfaEnabled: user.mfaEnabled,
    };
  }

  async enableMfa(userId: string, code: string, meta: ClientRequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecretEnc) {
      throw new BadRequestException('Run MFA setup first before verifying a code.');
    }

    const secretBase32 = this.decryptMfaSecret(user.mfaSecretEnc);
    if (!this.verifyTotp(secretBase32, user.email, code)) {
      throw new BadRequestException('Invalid 6-digit TOTP code.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaVerifiedAt: new Date() },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'MFA_ENABLED',
      resourceType: 'User',
      resourceId: user.id,
      moduleCode: 'IDENTITY_GUARDIAN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { mfaEnabled: true };
  }

  async disableMfa(userId: string, code: string, meta: ClientRequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecretEnc) {
      throw new BadRequestException('MFA is not currently enabled.');
    }

    const secretBase32 = this.decryptMfaSecret(user.mfaSecretEnc);
    if (!this.verifyTotp(secretBase32, user.email, code)) {
      throw new UnauthorizedException('Invalid TOTP code.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaVerifiedAt: null },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'MFA_DISABLED',
      resourceType: 'User',
      resourceId: user.id,
      moduleCode: 'IDENTITY_GUARDIAN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { mfaEnabled: false };
  }

  async refreshSession(rawRefreshToken: string, meta: ClientRequestMeta) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token missing.');
    }

    let payload: { sub: string; sid: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Malformed refresh token.');
    }

    const incomingHash = sha256Hex(rawRefreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      session.refreshTokenHash !== incomingHash ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt !== null
    ) {
      throw new UnauthorizedException('Refresh session invalid or revoked.');
    }

    const tokens = await this.signSessionTokens(session.user, session.id);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256Hex(tokens.refreshToken),
        lastActivityAt: new Date(),
        ipAddress: meta.ipAddress ?? session.ipAddress,
      },
    });

    const profile = await this.getUserProfile(session.userId, session.id);
    return {
      ...tokens,
      user: profile,
      sessionId: session.id,
      clientType: session.clientType,
    };
  }

  async logout(sessionId: string, userId: string, organizationId: string, meta: ClientRequestMeta) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: 'AUTH_LOGOUT',
      resourceType: 'UserSession',
      resourceId: sessionId,
      moduleCode: 'IDENTITY_GUARDIAN',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { loggedOut: true };
  }

  async getUserProfile(userId: string, sessionId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        passkeys: {
          select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found.');

    const permissions = new Set<string>();
    const roles = user.roles.map((ur) => {
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.code);
      }
      return ur.role.code;
    });

    return {
      id: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      roles,
      permissions: Array.from(permissions),
      passkeyCount: user.passkeys.length,
      passkeys: user.passkeys,
      sessionId,
    };
  }

  async getOwnSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        clientType: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        revokedAt: true,
        lastActivityAt: true,
        createdAt: true,
      },
      take: 30,
    });
  }

  async revokeOwnSession(userId: string, organizationId: string, targetSessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: targetSessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found.');

    await this.prisma.userSession.update({
      where: { id: targetSessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: 'SESSION_REVOKED',
      resourceType: 'UserSession',
      resourceId: targetSessionId,
      moduleCode: 'ACCESS_GUARDIAN',
    });

    return { revoked: true, sessionId: targetSessionId };
  }

  async getIdentityOverview(userId: string, organizationId: string) {
    const [profile, loginHistory, activeSessions, devices] = await Promise.all([
      this.getUserProfile(userId),
      this.prisma.loginActivity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.userSession.count({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.device.findMany({
        where: { userId, organizationId, deletedAt: null },
        select: {
          id: true,
          deviceName: true,
          platform: true,
          osVersion: true,
          complianceStatus: true,
          postureScore: true,
          lastSeenAt: true,
        },
      }),
    ]);

    const suspiciousLogins = loginHistory.filter((l) => l.isSuspicious).length;
    const securityScore = Math.min(
      100,
      50 +
        (profile.mfaEnabled ? 30 : 0) +
        (profile.passkeyCount > 0 ? 15 : 0) +
        (suspiciousLogins === 0 ? 5 : 0),
    );

    return {
      profile,
      activeSessions,
      suspiciousLoginCount: suspiciousLogins,
      identitySecurityScore: securityScore,
      loginHistory,
      registeredDevices: devices,
      breachProviderStatus:
        this.configService.get<string>('HIBP_ENABLED') === 'true'
          ? 'HIBP_K_ANON_ENABLED'
          : 'LOCAL_K_ANON_ONLY',
    };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.deletedAt === null) {
      const rawToken = generateSecureToken(32);
      const tokenHash = sha256Hex(rawToken);
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      await this.auditService.record({
        organizationId: user.organizationId,
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        moduleCode: 'IDENTITY_GUARDIAN',
      });

      return {
        message: 'If an active account matches this email, password reset instructions have been queued.',
        ...(process.env.NODE_ENV === 'test' ? { testResetToken: rawToken } : {}),
      };
    }

    return {
      message: 'If an active account matches this email, password reset instructions have been queued.',
    };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const tokenHash = sha256Hex(dto.token.trim());
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
      throw new BadRequestException('Reset token is invalid or expired.');
    }

    const newHash = await hashSecretArgon2id(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newHash, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all active sessions after password change
      this.prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.record({
      organizationId: record.user.organizationId,
      actorUserId: record.userId,
      actorEmail: record.user.email,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'User',
      resourceId: record.userId,
      moduleCode: 'IDENTITY_GUARDIAN',
    });

    return { message: 'Password updated and existing sessions revoked.' };
  }

  async createPasskeyChallenge(userId: string) {
    const challenge = generateSecureToken(32);
    return {
      challenge,
      rp: { name: 'SIS Cyber Fortress' },
      userId,
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      timeout: 60000,
    };
  }

  async registerPasskey(userId: string, organizationId: string, dto: RegisterPasskeyDto) {
    const existing = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: dto.credentialId },
    });
    if (existing) {
      throw new ConflictException('Passkey credential ID already registered.');
    }

    const created = await this.prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId: dto.credentialId,
        publicKey: dto.publicKey,
        transports: dto.transports ?? ['internal'],
        deviceLabel: dto.deviceLabel,
      },
    });

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: 'PASSKEY_REGISTERED',
      resourceType: 'PasskeyCredential',
      resourceId: created.id,
      moduleCode: 'IDENTITY_GUARDIAN',
    });

    return created;
  }

  /**
   * Privacy-preserving k-anonymity password breach prefix check (Module 01).
   * Accepts ONLY a 5-char SHA-1 hex prefix; never receives or logs plaintext passwords.
   */
  async checkCompromisedPrefix(user: { id: string; organizationId: string }, dto: BreachPrefixCheckDto) {
    const prefix = dto.sha1Prefix.toUpperCase();
    const hibpEnabled = this.configService.get<string>('HIBP_ENABLED') === 'true';

    if (hibpEnabled) {
      try {
        const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
          headers: { 'Add-Padding': 'true', 'User-Agent': 'SIS-Cyber-Fortress/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const text = await res.text();
          const suffixes = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 500)
            .map((line) => {
              const [suffix, countStr] = line.split(':');
              return { suffix, count: Number(countStr || 0) };
            });

          return {
            prefix,
            providerStatus: 'HIBP_RANGE_API',
            liveExternalLookup: true,
            suffixCount: suffixes.length,
            suffixes,
            privacyNote:
              'Only the 5-character SHA-1 prefix was transmitted using k-anonymity; full hashes and passwords stay client-side.',
            checkedAt: new Date().toISOString(),
          };
        }
      } catch {
        // Fall through to honest unavailable response
      }

      return {
        prefix,
        providerStatus: 'HIBP_UNAVAILABLE',
        liveExternalLookup: false,
        suffixCount: 0,
        suffixes: [],
        privacyNote:
          'HIBP Range API request failed or timed out; cannot verify breach exposure externally right now.',
        checkedAt: new Date().toISOString(),
      };
    }

    // Well-known benchmark prefixes (e.g., 5BAA6 for "password", 7C4A8 for "123456") for offline k-anon verification
    const knownBenchmarkSuffixes: Record<string, Array<{ suffix: string; count: number }>> = {
      '5BAA6': [{ suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8', count: 9545824 }],
      '7C4A8': [{ suffix: 'D09CA3762AF61E59520943DC26494F8941B', count: 29042514 }],
      'B1B37': [{ suffix: '73A05C0ED0176787A4F1574FF0075F7521E', count: 4120000 }],
    };

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'BREACH_K_ANON_CHECK',
      resourceType: 'IdentityCheck',
      moduleCode: 'IDENTITY_GUARDIAN',
      details: { prefixLength: 5, mode: 'LOCAL_K_ANON_BENCHMARK' },
    });

    return {
      prefix,
      providerStatus: 'LOCAL_K_ANON_ONLY',
      liveExternalLookup: false,
      suffixCount: (knownBenchmarkSuffixes[prefix] ?? []).length,
      suffixes: knownBenchmarkSuffixes[prefix] ?? [],
      privacyNote:
        'External HIBP lookup is disabled (HIBP_ENABLED=false). Local offline k-anonymity dataset checked; compare your full SHA-1 suffix locally.',
      checkedAt: new Date().toISOString(),
    };
  }

  private async createUserSession(
    userId: string,
    clientType: 'web' | 'android',
    deviceName: string,
    ipAddress?: string,
    userAgent?: string,
    fcmToken?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const placeholderHash = sha256Hex(generateSecureToken(32));

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: placeholderHash,
        clientType,
        deviceName,
        ipAddress,
        userAgent,
        fcmToken,
        expiresAt,
      },
    });

    const tokens = await this.signSessionTokens(user, session.id);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: sha256Hex(tokens.refreshToken) },
    });

    const profile = await this.getUserProfile(user.id, session.id);
    return {
      mfaRequired: false,
      clientType,
      sessionId: session.id,
      user: profile,
      ...tokens,
    };
  }

  private async signSessionTokens(
    user: { id: string; organizationId: string; email: string },
    sessionId: string,
  ) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        orgId: user.organizationId,
        sid: sessionId,
        email: user.email,
        type: 'access',
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m') as never,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        orgId: user.organizationId,
        sid: sessionId,
        type: 'refresh',
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as never,
      },
    );

    return { accessToken, refreshToken };
  }

  private decryptMfaSecret(encryptedJson: string): string {
    const envelope = JSON.parse(encryptedJson) as {
      ciphertext: string;
      iv: string;
      authTag: string;
    };
    return decryptAes256Gcm(envelope, this.getWrappingKey()).toString('utf8');
  }

  private verifyTotp(base32Secret: string, label: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: 'SIS Cyber Fortress',
      label,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32Secret),
    });
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  private async raiseSuspiciousLoginAlert(
    organizationId: string,
    userId: string,
    email: string,
    description: string,
  ) {
    const mod = await this.prisma.securityModule.findUnique({
      where: { code: 'IDENTITY_GUARDIAN' },
    });
    if (mod) {
      await this.prisma.securityAlert.create({
        data: {
          organizationId,
          moduleId: mod.id,
          userId,
          title: `Suspicious Sign-In Activity: ${email}`,
          description,
          severity: 'HIGH',
          status: 'OPEN',
          category: 'SUSPICIOUS_LOGIN',
          sourceRef: `user:${userId}`,
        },
      });
    }

    await this.notificationsService.createAndDispatch({
      organizationId,
      userId,
      title: 'Suspicious Sign-In Activity Detected',
      message: description,
      severity: 'HIGH',
      moduleCode: 'IDENTITY_GUARDIAN',
      deepLink: '/modules/identity-guardian',
      resourceType: 'LoginActivity',
    });
  }
}
