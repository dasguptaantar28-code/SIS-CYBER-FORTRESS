# SIS Cyber Fortress — System Architecture

## 1. High-Level Ecosystem Topology

```
+-----------------------+       HTTPS / REST + Bearer JWT       +------------------------+
|  Native Android APK   | ------------------------------------> |  NestJS Backend API    |
| (com.sis.cyberfortress)|      Keystore EncryptedPrefs         |  (/api/v1 + /soc WS)   |
+-----------------------+                                       +-----------+------------+
                                                                            |
+-----------------------+       HTTPS / HttpOnly SameSite Cookies           | Prisma ORM
|  Next.js Web Portal   | --------------------------------------------------+
| (Vercel Compatible)   |       + Socket.IO /soc                            v
+-----------------------+                                       +------------------------+
                                                                |   PostgreSQL 16 DB     |
                                                                |   + Encrypted Backups  |
                                                                +------------------------+
```

## 2. Security & Trust Boundaries

- **Shared Identity & Server-Side RBAC:** Web and Android authenticate against the same `/api/v1/auth` service. Web sessions store tokens strictly in `HttpOnly`, `SameSite` cookies (never `localStorage`); Android stores tokens in Keystore-backed `EncryptedSharedPreferences`. Every API route enforces `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard` server-side.
- **Zero-Knowledge Vault Boundary (Module 05):** Vault encryption (`PBKDF2-SHA256` 600k rounds + `AES-256-GCM`) happens strictly inside the Web browser (`crypto.subtle`) or Android device (`javax.crypto`). The NestJS API and PostgreSQL `VaultRecord` table persist only ciphertext, IV, authTag, and salt; `VaultService` scopes all queries to `userId === currentUser.id`, preventing Super Admin access to user secrets.
- **SSRF & Scope Boundary (Module 07 WebShield):** Scanning requires a verified or explicitly admin-approved `RegisteredAsset`. Before any DNS, TLS, or HTTP connection, `validateSafeOutboundUrl()` blocks non-HTTP(S) schemes, embedded credentials, non-80/443 ports, `localhost`, `.local`/`.internal` suffixes, and every resolved private/loopback/link-local/CGNAT/multicast IPv4/IPv6 IP address. Redirects are inspected manually (`redirect: 'manual'`, max 3 hops).
- **Android OS Policy Boundary (Modules 03 & 04):** Uses launcher `<queries>` visibility instead of privileged `QUERY_ALL_PACKAGES`, requests `ACCESS_FINE_LOCATION` only optionally inside Network Sentinel with explicit rationale, and explicitly labels OS-restricted data as unavailable rather than fabricating telemetry.
