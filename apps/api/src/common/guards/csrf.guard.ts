import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { constantTimeEqualHex } from '../security/crypto.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/mfa/verify',
  '/api/v1/auth/password-reset/request',
  '/api/v1/auth/password-reset/confirm',
]);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (CSRF_EXEMPT_PATHS.has(path)) return true;

    // Native mobile clients and Bearer-authenticated API callers do not rely on browser cookies
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return true;
    if (req.headers['x-client-platform'] === 'android') return true;

    const hasSessionCookie =
      Boolean(req.cookies?.sis_access_token) || Boolean(req.cookies?.sis_refresh_token);
    if (!hasSessionCookie) return true;

    const cookieCsrf = req.cookies?.sis_csrf_token;
    const headerCsrf = req.headers['x-csrf-token'];

    if (
      typeof cookieCsrf !== 'string' ||
      typeof headerCsrf !== 'string' ||
      cookieCsrf.length < 16 ||
      !constantTimeEqualHex(cookieCsrf, headerCsrf)
    ) {
      throw new ForbiddenException('CSRF verification failed: missing or mismatched X-CSRF-Token.');
    }

    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      if (!allowedOrigins.includes(origin)) {
        throw new ForbiddenException('Origin header is not in CORS allowlist.');
      }
    }

    return true;
  }
}
