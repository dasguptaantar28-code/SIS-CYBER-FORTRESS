import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { generateSecureToken } from '../common/security/crypto.util';
import { AuthService, ClientRequestMeta } from './auth.service';
import {
  BreachPrefixCheckDto,
  ConfirmPasswordResetDto,
  LoginDto,
  MfaCodeDto,
  MfaVerifyLoginDto,
  RefreshTokenDto,
  RegisterDto,
  RegisterPasskeyDto,
  RequestPasswordResetDto,
} from './dto/auth.dto';

@ApiTags('Authentication & Identity Guardian')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractMeta(req: Request): ClientRequestMeta {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || req.socket?.remoteAddress;
    return {
      ipAddress,
      userAgent: req.headers['user-agent'],
      clientPlatformHeader:
        typeof req.headers['x-client-platform'] === 'string'
          ? req.headers['x-client-platform'].toLowerCase()
          : undefined,
    };
  }

  private applySessionCookies(res: Response, accessToken: string, refreshToken: string): string {
    const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
    const sameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax';
    const csrfToken = generateSecureToken(16);

    res.cookie('sis_access_token', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('sis_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie('sis_csrf_token', csrfToken, {
      httpOnly: false,
      secure: isSecure,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return csrfToken;
  }

  private clearSessionCookies(res: Response) {
    res.clearCookie('sis_access_token', { path: '/' });
    res.clearCookie('sis_refresh_token', { path: '/api/v1/auth' });
    res.clearCookie('sis_csrf_token', { path: '/' });
  }

  private formatSessionResponse(
    res: Response,
    result: Awaited<ReturnType<AuthService['register']>>,
  ) {
    if (result.clientType === 'android') {
      return {
        mfaRequired: false,
        clientType: result.clientType,
        sessionId: result.sessionId,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    }

    const csrfToken = this.applySessionCookies(res, result.accessToken, result.refreshToken);
    return {
      mfaRequired: false,
      clientType: result.clientType,
      sessionId: result.sessionId,
      user: result.user,
      csrfToken,
    };
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto, this.extractMeta(req));
    return this.formatSessionResponse(res, result);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate user via Argon2id and create tracked session' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, this.extractMeta(req));
    if ('mfaRequired' in result && result.mfaRequired) {
      return result;
    }
    return this.formatSessionResponse(
      res,
      result as Awaited<ReturnType<AuthService['register']>>,
    );
  }

  @Public()
  @Post('mfa/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Complete login with 6-digit TOTP MFA verification' })
  async verifyMfa(
    @Body() dto: MfaVerifyLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyMfaLogin(dto, this.extractMeta(req));
    return this.formatSessionResponse(res, result);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate refresh token and issue fresh session tokens' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefresh = dto.refreshToken || req.cookies?.sis_refresh_token || '';
    const result = await this.authService.refreshSession(rawRefresh, this.extractMeta(req));

    if (result.clientType === 'android') {
      return {
        clientType: result.clientType,
        sessionId: result.sessionId,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    }

    const csrfToken = this.applySessionCookies(res, result.accessToken, result.refreshToken);
    return {
      clientType: result.clientType,
      sessionId: result.sessionId,
      user: result.user,
      csrfToken,
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke active session and clear authentication cookies' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearSessionCookies(res);
    return this.authService.logout(user.sessionId, user.id, user.organizationId, this.extractMeta(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile, roles, and permissions' })
  async me(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = await this.authService.getUserProfile(user.id, user.sessionId);
    let csrfToken = typeof req.cookies?.sis_csrf_token === 'string' ? req.cookies.sis_csrf_token : '';
    if (!csrfToken) {
      csrfToken = generateSecureToken(16);
      const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
      const sameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax';
      res.cookie('sis_csrf_token', csrfToken, {
        httpOnly: false,
        secure: isSecure,
        sameSite,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return { ...profile, csrfToken };
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret & QR code for MFA enrollment' })
  setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupMfa(user.id);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify TOTP code and activate MFA on account' })
  enableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaCodeDto, @Req() req: Request) {
    return this.authService.enableMfa(user.id, dto.code, this.extractMeta(req));
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify TOTP code and disable MFA' })
  disableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaCodeDto, @Req() req: Request) {
    return this.authService.disableMfa(user.id, dto.code, this.extractMeta(req));
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active & recent sessions for the current user' })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getOwnSessions(user.id);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session belonging to current user' })
  revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.authService.revokeOwnSession(user.id, user.organizationId, id);
  }

  @Get('identity-overview')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Module 01 Identity Guardian personal security overview' })
  identityOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getIdentityOverview(user.id, user.organizationId);
  }

  @Post('breach-check')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Privacy-preserving k-anonymity 5-char SHA-1 prefix breach lookup' })
  breachCheck(@CurrentUser() user: AuthenticatedUser, @Body() dto: BreachPrefixCheckDto) {
    return this.authService.checkCompromisedPrefix(user, dto);
  }

  @Post('passkeys/challenge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue WebAuthn/Passkey-ready registration challenge' })
  passkeyChallenge(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.createPasskeyChallenge(user.id);
  }

  @Post('passkeys/register')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register passkey credential metadata' })
  registerPasskey(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPasskeyDto) {
    return this.authService.registerPasskey(user.id, user.organizationId, dto);
  }

  @Public()
  @Post('password-reset/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request one-time password reset token' })
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Confirm one-time password reset and revoke prior sessions' })
  confirmReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(dto);
  }
}
