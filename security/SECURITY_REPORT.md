# Website & Ecosystem Security Assessment

- Assessment date: 2026-11-11
- Project/workspace: `c:\Users\This PC\Desktop\SIS-CYBER-FORTRESS`
- Mode: Both (Audit + Safe Protection + Verification)
- Assessor: SIS Cyber Fortress Engineering / `sis-advanced-web-security`
- Scope inspected: `apps/api` (NestJS REST & WebSocket API + Prisma/PostgreSQL), `apps/web` (Next.js App Router), `apps/mobile` (Kotlin/Jetpack Compose Android), `packages/shared-contracts`, `infrastructure/`
- External authorization record (if applicable): Not applicable (local workspace build & non-destructive integration testing only)

## Executive summary

SIS Cyber Fortress was architected and audited defensively across its backend API, PostgreSQL schema, Next.js web application, and native Android client. During the security audit, two concrete issues were detected and remediated immediately (`SIS-001` missing server-side CSRF double-submit guard on cookie-authenticated mutations, and `SIS-002` horizontal scoping in global search for `REGULAR_USER` callers). Two major-version transitive dependency advisories (`SIS-003` Next.js 15->16 / PostCSS and `SIS-004` Prisma 6->7 CLI `@prisma/config`) are preserved as `NEEDS OWNER ACTION` rather than performing unapproved major upgrades.

## Detected environment

| Component | Finding | Confidence | Evidence |
|---|---|---|---|
| Application/framework | NestJS 11 (`@sis/api`), Next.js 15.5.29 (`@sis/web`), Android Kotlin 2.2.10 / Jetpack Compose (`com.sis.cyberfortress`) | Confirmed | `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/app/build.gradle.kts` |
| Runtime/version | Node.js `v24.22.1`, OpenJDK `25.0.4` (Android Studio JBR), AGP `9.2.1` | Confirmed | `node -v`, `jbr/bin/java.exe -version`, `build.gradle.kts` |
| Hosting/deployment | Vercel-targeted web (`apps/web/vercel.json`), Docker Compose / standalone Node API (`docker-compose.yml`, `infrastructure/docker/`) | Inferred (source-only) | `apps/web/vercel.json`, `docker-compose.yml` |
| Database/storage | PostgreSQL 16 via Prisma ORM `6.19.3`, local encrypted backup dir (`./storage/backups`) | Confirmed | `apps/api/prisma/schema.prisma`, `apps/api/src/backup/backup.service.ts` |
| Authentication | Argon2id (`@node-rs/argon2`), JWT access + rotating hashed refresh tokens, HttpOnly cookies (web), Keystore EncryptedSharedPreferences (Android), RFC 6238 TOTP MFA | Confirmed | `apps/api/src/auth/auth.service.ts`, `auth.controller.ts`, `SecurePrefsManager.kt` |
| CDN/WAF/DDoS | Local rate limiting (`@nestjs/throttler`) + `helmet`; no live edge CDN/WAF deployed in workspace | Inferred | `apps/api/src/app.module.ts`, `apps/api/src/main.ts` |

## Risk summary

| Severity | Count | Notes |
|---|---:|---|
| Critical | 0 | — |
| High | 2 | `SIS-001` Remediated; `SIS-004` Transitive Prisma CLI (`dev` / major v7 upgrade) |
| Medium | 2 | `SIS-002` Remediated; `SIS-003` Transitive Next.js/PostCSS (major v16 upgrade) |
| Low | 1 | `SIS-005` CSP `'unsafe-inline'`/`'unsafe-eval'` compatibility allowance in `next.config.ts` |
| Info | 1 | `SIS-006` Optional external feeds (HIBP/VT/GSB/FCM) unconfigured in local dev |

## Findings

### [SIS-001] Cookie-Authenticated State Mutations Lacked Server-Side CSRF Enforcement — High / P1
- Status: FIXED
- Confidence: High
- Affected component/file/route: `apps/api/src/app.module.ts`, `apps/web/src/lib/api.ts`
- Evidence: `AuthController` issued `sis_csrf_token` cookie, but no global guard verified `X-CSRF-Token` against `sis_csrf_token` on mutating requests.
- Impact: Cross-origin state-changing requests from an untrusted site could succeed if `SameSite=None` is configured in cross-domain deployments.
- Recommendation: Enforce double-submit `X-CSRF-Token` comparison and Origin allowlist checking for cookie-authenticated mutations.
- Safe to auto-fix?: Yes
- Change made: Added `apps/api/src/common/guards/csrf.guard.ts`, registered in `AppModule`, and updated `apps/web/src/lib/api.ts` to send `X-CSRF-Token`.
- Verification: Tested in `apps/api/test/app.e2e-spec.ts` (`403` without header, `201` with header).
- Residual risk: Low; requires HTTPS (`COOKIE_SECURE=true`) in production.

### [SIS-002] Global Search Did Not Scope Alerts/Devices to Caller Ownership for Regular Users — Medium / P1
- Status: FIXED
- Confidence: High
- Affected component/file/route: `apps/api/src/dashboard/dashboard.service.ts` (`globalSearch`)
- Evidence: `globalSearch` filtered `securityAlert` and `device` only by `organizationId`, unlike `listDevices` and `listAlerts`.
- Impact: A `REGULAR_USER` could discover alert titles or device names belonging to another user in the same organization via search.
- Recommendation: Apply `{ userId: user.id }` filter unless caller holds an admin, SOC, or auditor role.
- Safe to auto-fix?: Yes
- Change made: Added `isAdminOrSoc` scoping inside `DashboardService.globalSearch`.
- Verification: Verified via TypeScript build and API test suite.
- Residual risk: Low.

### [SIS-003] Transitive Next.js / PostCSS Advisories — Medium / P2
- Status: NEEDS OWNER ACTION
- Confidence: High
- Affected component/file/route: `apps/web/package.json` (`next@^15.5.0`)
- Evidence: `npm audit --omit=dev --json` reported `next` / `postcss` moderate/high advisories with `fixAvailable: { name: "next", version: "16.4.6", isSemVerMajor: true }`.
- Impact: Potential CSS sourcemap / stringify issues during build tooling if untrusted CSS inputs are compiled.
- Recommendation: Evaluate upgrading `next` to `16.4.6+` in staging after regression testing.
- Safe to auto-fix?: No (major framework upgrade).
- Change made: None.
- Verification: `npm audit --omit=dev --json`.
- Residual risk: Low at runtime because no untrusted user CSS is compiled on the server.

### [SIS-004] Transitive Prisma CLI `@prisma/config` / `deepmerge-ts` Advisory — High / P2
- Status: NEEDS OWNER ACTION
- Confidence: High
- Affected component/file/route: `apps/api/package.json` (`prisma@6.19.3`)
- Evidence: `npm audit --omit=dev --json` reported `deepmerge-ts` stack exhaustion via `@prisma/config` (`fixAvailable: prisma@7.10.1`, major).
- Impact: CLI-only recursive config merging risk; does not execute in runtime REST requests.
- Recommendation: Plan Prisma 7 upgrade when ready for ESM/config migration.
- Safe to auto-fix?: No (major ORM upgrade).
- Change made: None.
- Verification: `npm audit --omit=dev --json`.
- Residual risk: Minimal in runtime API process.

### [SIS-005] Next.js CSP Allows `'unsafe-inline'` and `'unsafe-eval'` — Low / P3
- Status: OPEN (Compatibility)
- Confidence: High
- Affected component/file/route: `apps/web/next.config.ts`
- Evidence: CSP header includes `"script-src 'self' 'unsafe-inline' 'unsafe-eval'"`.
- Impact: Reduces strictness of inline-script XSS defense-in-depth.
- Recommendation: Adopt Next.js nonce-based middleware CSP before production launch.
- Safe to auto-fix?: No (requires dynamic SSR nonce plumbing across pages).

### [SIS-006] Optional External Integrations Unconfigured in Local Environment — Info
- Status: OPEN (Expected Local State)
- Confidence: High
- Affected component/file/route: `IntegrationStatus` table (`virustotal`, `google_safe_browsing`, `hibp_k_anon`, `firebase_fcm`)
- Evidence: Seed and UI explicitly report `UNCONFIGURED` / `LOCAL_ONLY`.
- Recommendation: Supply API keys via environment secrets in production deployment.

## Verification performed

| Check | Result | Evidence/command | Notes |
|---|---|---|---|
| API TypeScript + Build | PASS | `npm --workspace=@sis/api run lint && npm --workspace=@sis/api run build` | Exit code 0 after final edit |
| API Security Unit Tests | PASS | `npm --workspace=@sis/api test` | 5/5 tests passed (SSRF, Argon2id, AES-256-GCM, CSV escape) |
| API PostgreSQL E2E Tests | PASS | `npm --workspace=@sis/api run test:e2e` | 6/6 suites passed against real PGlite PostgreSQL |
| Web TypeScript + Unit Tests | PASS | `npm --workspace=@sis/web run lint && npm --workspace=@sis/web test` | 4/4 Jest tests passed (Vault WebCrypto, Login, RBAC contracts) |
| Web Production Build | PASS | `npm --workspace=@sis/web run build` | All 22 Next.js routes built |
| Android Unit Tests + APK Build | PASS | `.\gradlew.bat testDebugUnitTest assembleDebug` | 2/2 JUnit tests passed; `app-debug.apk` generated |
| Production Dependency Audit | PASS WITH FINDINGS | `npm audit --omit=dev --json` | 0 critical, 4 high (Prisma CLI / PostCSS), 1 moderate |
| Live Staging DAST / WAF | NOT TESTED | — | No external staging URL deployed |

## Not tested / owner action required
- Configure production TLS certificates, HSTS, edge WAF/DDoS controls (e.g., Cloudflare / Vercel Edge), and `COOKIE_SECURE=true` + `COOKIE_SAMESITE=none` when deploying web and API on separate origins.
- Generate and store Android release signing keystore outside Git before publishing Play Store / enterprise release builds.
- Review major upgrades (`next@16`, `prisma@7`) when scheduling maintenance.

## Incident readiness and recovery notes
- Module 11 (`BackupService`) verifies AES-256-GCM round-trip decryption and SHA-256 checksums before reporting `VERIFIED_SUCCESS`.
- Module 08 (`ForensicsService`) appends immutable `ChainOfCustody` entries on collection, transfer, and export.

> This is a point-in-time assessment, not a guarantee that the website is attack-proof.
