# SIS Cyber Fortress — 12-in-1 Enterprise Cybersecurity Ecosystem

**Secure • Monitor • Protect**

SIS Cyber Fortress is a unified enterprise cybersecurity ecosystem comprising:
1. **Native Android Application** (`apps/mobile`, Kotlin + Jetpack Compose + Material 3 + Android Keystore + BiometricPrompt + WorkManager + Retrofit)
2. **Enterprise Super Admin & Security Web Portal** (`apps/web`, Next.js App Router + TypeScript + Tailwind CSS + Recharts + Socket.IO)
3. **Backend REST & WebSocket API** (`apps/api`, NestJS + TypeScript + Prisma ORM + Swagger + Helmet + Throttler)
4. **PostgreSQL Relational Database** (`apps/api/prisma/schema.prisma` + SQL migrations)
5. **Shared TypeScript Contracts** (`packages/shared-contracts`)

---

## 12 Integrated Cybersecurity Modules

| # | Module | Slug | Core Capabilities |
|---|--------|------|-------------------|
| 01 | **SIS Identity Guardian** | `identity-guardian` | Argon2id auth, TOTP MFA, passkey-ready registration, login history, suspicious sign-in alerts, k-anonymity 5-char SHA-1 breach check |
| 02 | **SIS Phishing Shield** | `phishing-shield` | URL/domain analyzer, Threat IOC correlation, lexical spoofing checks, optional external reputation adapters, false-positive reporting |
| 03 | **SIS Endpoint Guardian** | `endpoint-guardian` | Android & workstation device registration, hardware security posture, permitted launcher app/permission review |
| 04 | **SIS Network Sentinel** | `network-sentinel` | Android `ConnectivityManager` / `WifiManager` awareness, open Wi-Fi warnings, OS privacy restriction disclosures, checklists |
| 05 | **SIS Vault Guardian** | `vault-guardian` | Client-side zero-knowledge AES-256-GCM + PBKDF2-SHA256 (600,000 rounds), BiometricPrompt/PIN unlock, recovery wrap, isolated from Super Admin |
| 06 | **SIS Ransomware Guardian** | `ransomware-guardian` | Defensive recovery readiness tied to verified encrypted backups, drill tracking, safe file-change indicators |
| 07 | **SIS WebShield** | `webshield` | Authorized asset ownership verification (DNS TXT / HTTP well-known / Admin approval), SSRF-hardened TLS, DNS SPF/DMARC & security header checks |
| 08 | **SIS Digital Forensics** | `digital-forensics` | Case IDs (`CASE-YYYY-NNNN`), SHA-256 evidence sealing, append-only chain-of-custody timeline, audited dossier exports |
| 09 | **SIS Access Guardian** | `access-guardian` | 5-role RBAC (`SUPER_ADMIN`, `SECURITY_ADMIN`, `MODULE_ADMIN`, `AUDITOR`, `REGULAR_USER`), active session inventory, remote session revocation |
| 10 | **SIS Threat Intelligence** | `threat-intelligence` | IOC registry (Domain, URL, IP, Hash), feed freshness tracking, source attribution, honest unconfigured-feed disclosure |
| 11 | **SIS Cloud Backup Guardian** | `cloud-backup` | AES-256-GCM encrypted backup archives, SHA-256 integrity verification before marking success, verified restore workflow |
| 12 | **SIS Cyber SOC** | `cyber-soc` | Live alert inbox correlated across all 11 modules, alert-to-incident escalation, assignment, WebSocket live updates, CSV/PDF exports |

---

## Local Development Setup

### 1. Environment Variables
Copy the template at the repository root:
```bash
cp .env.example .env
```
Generate strong 64+ char secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `BACKUP_MASTER_ENVELOPE_KEY`.
To create local development demo accounts (never enable in production), set `ENABLE_DEMO_SEED=true`.

### 2. Option A: Docker Compose (PostgreSQL + Redis + API + Web)
```bash
docker compose up --build
```
- Web Portal: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`
- OpenAPI Swagger Docs: `http://localhost:4000/api/docs`

### 3. Option B: Local Node Workspace (with External Postgres or Built-in PGlite Harness)
```bash
npm install
npm run build:contracts
npm run prisma:generate
```
If PostgreSQL is running at `DATABASE_URL`:
```bash
npm --workspace=@sis/api run prisma:migrate
npm --workspace=@sis/api run prisma:seed
npm run dev:api
npm run dev:web
```
If Docker/PostgreSQL is not installed locally, start the local PostgreSQL wire server:
```bash
cd apps/api
npx tsx src/scripts/dev-with-local-pg.ts --migrate-and-seed
```
Then in separate terminals run `npm run dev:api` and `npm run dev:web`.

---

## Development Demo Credentials (Only when `ENABLE_DEMO_SEED=true` and `NODE_ENV !== production`)
- **Super Admin:** `admin@sisfortress.local` / `ChangeMe@2026!`
- **Security Admin:** `secadmin@sisfortress.local` / `ChangeMe@2026!`
- **Module Admin:** `modadmin@sisfortress.local` / `ChangeMe@2026!`
- **Auditor:** `auditor@sisfortress.local` / `ChangeMe@2026!`
- **Regular User:** `analyst@sisfortress.local` / `ChangeMe@2026!`

---

## Testing & Verification Commands
```bash
# Backend Unit & PostgreSQL End-to-End Integration Tests
npm --workspace=@sis/api test
npm --workspace=@sis/api run test:e2e

# Web Application Type-Check, Unit Tests & Production Build
npm --workspace=@sis/web run lint
npm --workspace=@sis/web test
npm --workspace=@sis/web run build

# Android Unit Tests & Debug APK Build (Windows PowerShell)
cd apps/mobile
.\gradlew.bat testDebugUnitTest assembleDebug
```
Debug APK output:
`apps/mobile/app/build/outputs/apk/debug/app-debug.apk`
