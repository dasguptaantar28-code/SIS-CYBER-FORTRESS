# Security Control Checklist — SIS Cyber Fortress

Assessment Date: 2026-11-11  
Scope: `apps/api` (NestJS + Prisma/PostgreSQL), `apps/web` (Next.js App Router), `apps/mobile` (Kotlin/Jetpack Compose Android), `infrastructure/`

| Domain | Control | Status | Evidence |
|---|---|---|---|
| Identity & Access | Password hashing with Argon2id | PASS | `apps/api/src/common/security/crypto.util.ts` (`@node-rs/argon2`), tested in `ssrf.guard.spec.ts` |
| Identity & Access | TOTP MFA enrollment, verification & encrypted secret storage | PASS | `apps/api/src/auth/auth.service.ts` (`otpauth` + AES-256-GCM wrapped `mfaSecretEnc`) |
| Identity & Access | Server-side RBAC on every sensitive endpoint | PASS | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`; verified across 5 roles in `app.e2e-spec.ts` |
| Identity & Access | Brute-force throttling & account lockout | PASS | `ThrottlerModule` + `@Throttle` + `MAX_FAILED_ATTEMPTS = 5` lockout in `auth.service.ts` |
| Identity & Access | HttpOnly, SameSite cookies on web (zero `localStorage` tokens) | PASS | `apps/api/src/auth/auth.controller.ts`, static scan across `apps/web/src` |
| Identity & Access | Android Keystore-backed token storage | PASS | `apps/mobile/.../SecurePrefsManager.kt` (`MasterKey.KeyScheme.AES256_GCM` + `EncryptedSharedPreferences`) |
| App & API | DTO input validation (`whitelist`, `forbidNonWhitelisted`) | PASS | `apps/api/src/main.ts` (`ValidationPipe`) + `class-validator` DTOs |
| App & API | Parameterized ORM queries (SQL injection prevention) | PASS | Prisma ORM parameterized queries throughout `apps/api/src` |
| App & API | CSRF double-submit & Origin enforcement | PASS | `apps/api/src/common/guards/csrf.guard.ts` + `apps/web/src/lib/api.ts`; verified in `app.e2e-spec.ts` |
| App & API | SSRF, DNS rebinding & private-network blocking (WebShield) | PASS | `apps/api/src/common/security/ssrf.guard.ts`; unit-tested in `ssrf.guard.spec.ts` & E2E |
| App & API | Authorized-scope-only website scanning | PASS | `scans.service.ts` blocks unverified/unapproved assets with `403` (verified in `app.e2e-spec.ts`) |
| App & API | Horizontal access control (Vault & Search isolation) | PASS | `vault.service.ts` (`userId` check) & `dashboard.service.ts` (`globalSearch` user scoping) |
| App & API | CSV formula injection protection in exports | PASS | `escapeCsvCell` in `crypto.util.ts`, unit-tested in `ssrf.guard.spec.ts` |
| Browser & HTTP | Security headers (`CSP`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) | PASS | `apps/web/next.config.ts` & `helmet` in `apps/api/src/main.ts` |
| Browser & HTTP | Production HSTS & HTTPS-only enforcement | NEEDS OWNER ACTION | Requires TLS termination / Vercel & reverse-proxy HTTPS deployment |
| Cryptography & Data | Zero-knowledge client-side AES-256-GCM Vault | PASS | `apps/web/src/lib/vault-crypto.ts`, `VaultCryptoManager.kt`, verified in Jest & JUnit |
| Cryptography & Data | Privacy-preserving k-anonymity breach prefix check | PASS | `auth.service.ts` accepts only 5-char SHA-1 prefix (`^[0-9A-Fa-f]{5}$`) |
| Cryptography & Data | Encrypted Cloud Backups with SHA-256 verification | PASS | `apps/api/src/backup/backup.service.ts` verifies decryption round-trip before marking `VERIFIED_SUCCESS` |
| Android Policy | No `QUERY_ALL_PACKAGES` or covert monitoring | PASS | `AndroidManifest.xml` uses standard launcher `<queries>`, debug-only cleartext HTTP |
| Supply Chain | Production `npm audit` dependency check | NEEDS OWNER ACTION | 5 transitive advisories (`next`/`postcss` v16 & `prisma` v7 require major version upgrade decision) |
| Edge / Live Host | Live CDN/WAF/DDoS & live staging DAST | NOT TESTED | Source workspace only; no authorized live production host deployed yet |

> This is a point-in-time assessment, not a guarantee that the website or ecosystem is attack-proof.
