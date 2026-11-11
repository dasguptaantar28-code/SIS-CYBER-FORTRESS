# Deployment Guide (Web on Vercel, Backend + PostgreSQL, Android Release APK)

## 1. PostgreSQL + NestJS Backend Deployment (Independent Hosting)
Vercel serverless functions are NOT suitable for long-lived NestJS WebSockets or persistent local encrypted backup storage. Deploy `apps/api` + PostgreSQL on Render, Railway, Fly.io, AWS ECS, or a hardened VPS:

1. Provision PostgreSQL 16 (`DATABASE_URL`).
2. Build contracts and API:
   ```bash
   npm ci
   npm run build:contracts
   npm --workspace=@sis/api run prisma:generate
   npm --workspace=@sis/api run build
   ```
3. Run database migrations & bootstrap base RBAC/modules (with `ENABLE_DEMO_SEED=false` in production!):
   ```bash
   cd apps/api
   npx prisma migrate deploy
   NODE_ENV=production ENABLE_DEMO_SEED=false npx tsx prisma/seed.ts
   ```
4. Set production environment variables:
   - `NODE_ENV=production`
   - `CORS_ORIGINS=https://your-vercel-app.vercel.app`
   - `COOKIE_SECURE=true`
   - `COOKIE_SAMESITE=none` (required when web and API are on distinct domains over HTTPS)
   - Strong random `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BACKUP_MASTER_ENVELOPE_KEY`
5. Start API: `node apps/api/dist/src/main.js` (or deploy via `infrastructure/docker/Dockerfile.api`).
6. Set `TRUST_PROXY=true` when hosting behind Vercel/Render/Koyeb/Cloudflare reverse proxies.

---

## Free-Tier Cloud Setup (Access From Anywhere at \$0)

1. **PostgreSQL Database (Free Tier):** Create a free PostgreSQL database on **Neon** (`neon.tech` — free tier does not expire) or **Supabase** or **Render Free Postgres**, and copy its `DATABASE_URL`.
2. **NestJS Backend API (Free Tier):** Push this repo to **GitHub**, then deploy `apps/api` using the included [render.yaml](../render.yaml) blueprint on **Render** (`render.com` Free Web Service) or **Koyeb** (`koyeb.com`). Set `CORS_ORIGINS=https://your-app.vercel.app`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, `TRUST_PROXY=true`, and your `DATABASE_URL`.
3. **Web Portal on Vercel (Free Tier):** Import the GitHub repo in **Vercel** (`vercel.com`), set Root Directory to `apps/web`, and set `NEXT_PUBLIC_API_URL=https://your-api-domain/api/v1` and `NEXT_PUBLIC_WS_URL=https://your-api-domain`.
4. **Android APK Anywhere:** Either open **Configure API Server URL** on the Debug APK Login screen and enter `https://your-api-domain/api/v1/`, or compile a Release APK with `./gradlew assembleRelease -PSIS_API_URL=https://your-api-domain/api/v1/`.

---

## 2. Website Deployment on Vercel (`apps/web`)
1. Import repository in Vercel and set **Root Directory** to `apps/web` (or configure `apps/web/vercel.json`).
2. Set Vercel Environment Variables:
   - `NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1`
   - `NEXT_PUBLIC_WS_URL=https://api.your-domain.com`
   - `NEXT_PUBLIC_APP_ENV=production`
3. Deploy. Every route builds statically/dynamically (`next build`) and communicates over HTTPS with the independent NestJS backend.

---

## 3. Android Debug & Signed Release APK Build (`apps/mobile`)

### Debug APK (Local Verification)
```bash
cd apps/mobile
./gradlew assembleDebug
```
Output: `apps/mobile/app/build/outputs/apk/debug/app-debug.apk`

### Signed Release APK (Production)
Never commit `.jks`/`.keystore` files or passwords to Git!
1. Generate a signing keystore outside the repository:
   ```bash
   keytool -genkey -v -keystore ~/sis-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias sis-fortress
   ```
2. Configure `signingConfigs { release { ... } }` in `apps/mobile/app/build.gradle.kts` reading store/key passwords from CI secrets or `local.properties` (gitignored).
3. Pass production API URL at build time:
   ```bash
   ./gradlew assembleRelease -PSIS_API_URL=https://api.your-domain.com/api/v1/
   ```
   Release builds enforce `usesCleartextTraffic="false"` (HTTPS-only) and R8 code shrinking/minification.
4. For Firebase Cloud Messaging push notifications, place your Firebase `google-services.json` into `apps/mobile/app/` (also gitignored) and configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` on the NestJS API.
