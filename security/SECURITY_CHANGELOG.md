# Security Changelog — SIS Cyber Fortress

## 2026-11-11 — Initial Defensive Hardening & Audit Remediations

| File | Change | Rationale | Verification | Rollback Notes |
|---|---|---|---|---|
| `apps/api/src/common/guards/csrf.guard.ts` | Added global `CsrfGuard` enforcing `X-CSRF-Token` double-submit validation (constant-time equality) and CORS Origin allowlist on cookie-authenticated mutations (`POST`, `PUT`, `PATCH`, `DELETE`). | Protects cookie-authenticated browser sessions against Cross-Site Request Forgery even if cross-origin `SameSite=None` is enabled in production. | Verified in `apps/api/test/app.e2e-spec.ts` (`blocks cookie-authenticated state mutations lacking X-CSRF-Token`). | Remove `{ provide: APP_GUARD, useClass: CsrfGuard }` from `apps/api/src/app.module.ts`. |
| `apps/api/src/app.module.ts` | Registered `CsrfGuard` in `APP_GUARD` pipeline ahead of `JwtAuthGuard`. | Ensures state-changing browser requests validate CSRF token consistently across all modules. | Verified via `npm --workspace=@sis/api run test:e2e`. | Remove `CsrfGuard` provider entry. |
| `apps/web/src/lib/api.ts` | Added `readCookie('sis_csrf_token')` helper and automatic `X-CSRF-Token` header attachment on mutating requests. | Supplies CSRF verification header cleanly without touching `localStorage`. | Verified via `npm --workspace=@sis/web run build` and `tsc --noEmit`. | Revert `rawFetch` header block in `apps/web/src/lib/api.ts`. |
| `apps/api/src/dashboard/dashboard.service.ts` | Scoped `globalSearch` queries for `SecurityAlert` and `Device` to `userId` when caller lacks Admin/SOC/Auditor role. | Prevents horizontal information disclosure (BOLA/IDOR) in global search results for `REGULAR_USER` accounts. | Verified via `tsc --noEmit`, `nest build`, and E2E test suite. | Revert `isAdminOrSoc` filter inside `globalSearch`. |
