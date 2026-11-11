# SIS Cyber Fortress — REST & WebSocket API Reference (`/api/v1`)

Interactive OpenAPI / Swagger UI is served by the backend at `/api/docs`.

## Authentication & Identity Guardian (`/api/v1/auth`)
- `POST /auth/register` — Create user account (`REGULAR_USER` default). Request: `{ email, fullName, password, clientType?, deviceName? }`.
- `POST /auth/login` — Verify Argon2id password, track `LoginActivity`, enforce brute-force lockout, issue HttpOnly cookies (`web`) or JSON tokens (`android`), or return `{ mfaRequired: true, challengeToken }`.
- `POST /auth/mfa/verify` — Complete login with `{ challengeToken, code }`.
- `POST /auth/mfa/setup` / `enable` / `disable` — TOTP enrollment & verification (`qrcode` + RFC 6238).
- `POST /auth/refresh` — Rotate refresh token hash in `UserSession` and return fresh tokens.
- `POST /auth/logout` — Revoke `UserSession` and clear cookies.
- `GET /auth/identity-overview` — Personal security score, MFA/passkey count, login history, registered devices.
- `POST /auth/breach-check` — Accepts ONLY `{ sha1Prefix: "^[0-9A-Fa-f]{5}$" }` (k-anonymity); rejects plaintext.
- `POST /auth/passkeys/challenge` & `register` — Passkey-ready WebAuthn registration metadata.

## Users, Roles & Access Guardian
- `GET /users`, `PATCH /users/:id/roles`, `PATCH /users/:id/status` — User governance (`users:read`, `roles:manage`, `users:manage`).
- `GET /roles`, `GET /permissions`, `PATCH /roles/:id/permissions` — RBAC policy inspection & updates.
- `GET /access-guardian/sessions`, `DELETE /access-guardian/sessions/:id` — Org-wide session listing & remote revocation.

## Modules, Devices & Posture
- `GET /modules`, `GET /modules/:slug`, `PATCH /modules/:slug/toggle` — 12 security modules status & toggle.
- `POST /devices/register`, `GET /devices`, `GET /devices/:id`, `DELETE /devices/:id` — Endpoint Guardian inventory & posture evaluation.
- `POST /posture/network`, `GET /posture/network` — Network Sentinel risk & checklist logs.
- `POST /posture/ransomware`, `GET /posture/ransomware` — Ransomware Guardian recovery readiness tied to verified backups.

## Scanners, Assets & Threat Intelligence
- `POST /assets`, `GET /assets`, `POST /assets/:id/verify`, `DELETE /assets/:id` — Authorized asset registry & DNS TXT / Well-Known HTTP / Admin approval.
- `POST /scans/phishing`, `POST /scans/webshield`, `GET /scans`, `POST /scans/:scanResultId/false-positive` — Phishing Shield & SSRF-protected WebShield scanners.
- `GET /threats/sources`, `GET /threats/indicators`, `POST /threats/indicators`, `DELETE /threats/indicators/:id` — IOC feed & indicator management.

## Zero-Knowledge Vault, Backups & Forensics
- `GET /vault/records`, `POST /vault/records`, `DELETE /vault/records/:id`, `GET /vault/activities`, `POST /vault/recovery-kit`, `POST /vault/recovery-kit/unlock` — Ciphertext-only zero-knowledge Vault APIs scoped strictly to `userId`.
- `POST /backups`, `GET /backups`, `POST /backups/:id/restore` — AES-256-GCM encrypted backup archive creation & SHA-256 verified restore.
- `POST /forensics/cases`, `GET /forensics/cases`, `GET /forensics/cases/:id`, `POST /forensics/cases/:id/evidence`, `POST /forensics/evidence/:id/custody`, `GET /forensics/cases/:id/export` — Digital Forensics case, SHA-256 evidence, immutable custody log, and audited export.

## Cyber SOC, Alerts, Incidents, Reports & Dashboard
- `POST /alerts`, `GET /alerts`, `PATCH /alerts/:id/status`, `POST /alerts/:id/escalate` — Alert triage & escalation to Incident.
- `POST /incidents`, `GET /incidents`, `PATCH /incidents/:id/status`, `POST /incidents/:id/assign` — SOC incident lifecycle.
- `GET /audit-logs`, `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
- `GET /reports/:category`, `GET /reports/:category/export/csv`, `GET /reports/:category/export/pdf`.
- `GET /health`, `GET /dashboard/overview`, `GET /dashboard/search?q=...`, `GET /settings`, `PUT /settings`.
- **WebSocket (`/soc`):** Authenticates via JWT cookie/auth token; emits `alert:created`, `alert:updated`, `incident:created`, `incident:updated`, and `notification:new`.
