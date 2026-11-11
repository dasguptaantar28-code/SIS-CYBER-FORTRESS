import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { LocalPgContext, startLocalPostgresHarness } from './helpers/pg-test-harness';

function extractCookieValue(setCookie: string[] | string | undefined, name: string): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const cookieStr of arr) {
    const part = cookieStr.split(';')[0]?.trim();
    if (part?.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return '';
}

describe('SIS Cyber Fortress API End-to-End Integration (PostgreSQL + RBAC + CSRF + 12 Modules)', () => {
  let pg: LocalPgContext;
  let app: INestApplication;

  let adminAgent: ReturnType<typeof request.agent>;
  let regularUserAgent: ReturnType<typeof request.agent>;
  let auditorAgent: ReturnType<typeof request.agent>;
  let adminCsrf = '';
  let userCsrf = '';
  let auditorCsrf = '';
  let androidAccessToken = '';
  let regularUserId = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-64-chars-minimum-length-for-integration-suite';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-64-chars-minimum-length-for-integration-suite';
    process.env.BACKUP_MASTER_ENVELOPE_KEY = 'test-backup-envelope-key-32bytes!';
    process.env.COOKIE_SECURE = 'false';

    pg = await startLocalPostgresHarness(55436);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    adminAgent = request.agent(app.getHttpServer());
    regularUserAgent = request.agent(app.getHttpServer());
    auditorAgent = request.agent(app.getHttpServer());
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    if (pg) await pg.cleanup();
  });

  it('GET /api/v1/health reports HEALTHY with connected PostgreSQL', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('HEALTHY');
    expect(res.body.database).toBe('CONNECTED');
  });

  it('authenticates Web (HttpOnly cookies, zero localStorage tokens) and Android (Bearer JSON) using shared backend', async () => {
    const webLogin = await adminAgent
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@sisfortress.local',
        password: 'ChangeMe@2026!',
        clientType: 'web',
      })
      .expect(201);

    expect(webLogin.body.accessToken).toBeUndefined();
    expect(webLogin.headers['set-cookie']).toBeDefined();
    expect(webLogin.body.user.roles).toContain('SUPER_ADMIN');
    adminCsrf = extractCookieValue(webLogin.headers['set-cookie'], 'sis_csrf_token');
    expect(adminCsrf.length).toBeGreaterThanOrEqual(16);

    const audLogin = await auditorAgent
      .post('/api/v1/auth/login')
      .send({
        email: 'auditor@sisfortress.local',
        password: 'ChangeMe@2026!',
        clientType: 'web',
      })
      .expect(201);
    auditorCsrf = extractCookieValue(audLogin.headers['set-cookie'], 'sis_csrf_token');

    const userLogin = await regularUserAgent
      .post('/api/v1/auth/login')
      .send({
        email: 'analyst@sisfortress.local',
        password: 'ChangeMe@2026!',
        clientType: 'web',
      })
      .expect(201);
    regularUserId = userLogin.body.user.id;
    userCsrf = extractCookieValue(userLogin.headers['set-cookie'], 'sis_csrf_token');

    const androidLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'android')
      .send({
        email: 'analyst@sisfortress.local',
        password: 'ChangeMe@2026!',
        clientType: 'android',
        deviceName: 'Pixel 8 Pro Test',
      })
      .expect(201);

    expect(androidLogin.body.accessToken).toBeDefined();
    expect(androidLogin.body.refreshToken).toBeDefined();
    androidAccessToken = androidLogin.body.accessToken;
  });

  it('blocks cookie-authenticated state mutations lacking X-CSRF-Token and enforces server-side RBAC', async () => {
    // Missing X-CSRF-Token on cookie-authenticated POST must be blocked (403)
    await regularUserAgent
      .post('/api/v1/scans/phishing')
      .send({ url: 'https://example.com' })
      .expect(403);

    await regularUserAgent.get('/api/v1/users').expect(403);
    await regularUserAgent.get('/api/v1/audit-logs').expect(403);
    await regularUserAgent.get('/api/v1/roles').expect(403);

    await auditorAgent.get('/api/v1/audit-logs').expect(200);
    await auditorAgent
      .patch(`/api/v1/users/${regularUserId}/roles`)
      .set('X-CSRF-Token', auditorCsrf)
      .send({ roleCodes: ['SUPER_ADMIN'] })
      .expect(403);

    const usersRes = await adminAgent.get('/api/v1/users').expect(200);
    expect(usersRes.body.length).toBeGreaterThanOrEqual(5);
  });

  it('registers Android device via Bearer token and reflects it in Dashboard and Notifications', async () => {
    const devRes = await request(app.getHttpServer())
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${androidAccessToken}`)
      .send({
        deviceName: 'SIS Android Emulator',
        platform: 'ANDROID',
        manufacturer: 'Google',
        model: 'Pixel 8',
        osVersion: 'Android 15',
        deviceIdentifier: 'test-android-device-001',
        screenLockEnabled: true,
        biometricSupported: true,
        encryptionEnabled: true,
        isRootedOrCompromised: false,
      })
      .expect(201);

    expect(devRes.body.complianceStatus).toBe('COMPLIANT');

    const overview = await adminAgent.get('/api/v1/dashboard/overview').expect(200);
    expect(overview.body.kpis.totalModules).toBe(12);
    expect(overview.body.kpis.registeredDevices).toBeGreaterThanOrEqual(1);
  });

  it('enforces Vault Guardian zero-knowledge isolation and stores ciphertext only', async () => {
    const created = await regularUserAgent
      .post('/api/v1/vault/records')
      .set('X-CSRF-Token', userCsrf)
      .send({
        recordType: 'PASSWORD',
        encryptedTitle: '{"iv":"abc","ct":"def"}',
        ciphertext: 'base64-encrypted-secret-blob',
        iv: 'base64-iv-12bytes',
        authTag: 'base64-tag-16bytes',
        salt: 'base64-salt-16bytes',
      })
      .expect(201);

    const adminVault = await adminAgent.get('/api/v1/vault/records').expect(200);
    expect(adminVault.body.find((r: { id: string }) => r.id === created.body.id)).toBeUndefined();

    await adminAgent
      .delete(`/api/v1/vault/records/${created.body.id}`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(403);
  });

  it('runs Phishing Shield IOC detection, WebShield authorization + SSRF policy, Forensics, Backup & SOC escalation', async () => {
    await regularUserAgent
      .post('/api/v1/auth/breach-check')
      .set('X-CSRF-Token', userCsrf)
      .send({ sha1Prefix: 'MyPlaintextPassword!' })
      .expect(400);

    const breachRes = await regularUserAgent
      .post('/api/v1/auth/breach-check')
      .set('X-CSRF-Token', userCsrf)
      .send({ sha1Prefix: '5BAA6' })
      .expect(201);
    expect(breachRes.body.suffixCount).toBeGreaterThanOrEqual(1);

    const phishRes = await regularUserAgent
      .post('/api/v1/scans/phishing')
      .set('X-CSRF-Token', userCsrf)
      .send({ url: 'http://verify-account-reset.example.invalid/auth' })
      .expect(201);
    expect(phishRes.body.riskLevel).toBe('HIGH_RISK');

    const unverifiedAsset = await adminAgent
      .post('/api/v1/assets')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Unverified Portal', targetUrl: 'https://ietf.org' })
      .expect(201);

    await adminAgent
      .post('/api/v1/scans/webshield')
      .set('X-CSRF-Token', adminCsrf)
      .send({ assetId: unverifiedAsset.body.id })
      .expect(403);

    await adminAgent
      .post('/api/v1/assets')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Internal Metadata', targetUrl: 'http://169.254.169.254/latest/meta-data' })
      .expect(403);

    const backupRes = await regularUserAgent
      .post('/api/v1/backups')
      .set('X-CSRF-Token', userCsrf)
      .send({
        backupName: 'Integration Test Backup',
        entries: [{ relativePath: 'notes/recovery.txt', content: 'SIS-Fortress-Verified-Content' }],
      })
      .expect(201);
    expect(backupRes.body.status).toBe('VERIFIED_SUCCESS');
    expect(backupRes.body.integrityVerified).toBe(true);

    const restoreRes = await regularUserAgent
      .post(`/api/v1/backups/${backupRes.body.id}/restore`)
      .set('X-CSRF-Token', userCsrf)
      .expect(201);
    expect(restoreRes.body.files[0].content).toBe('SIS-Fortress-Verified-Content');

    const ransomRes = await regularUserAgent
      .post('/api/v1/posture/ransomware')
      .set('X-CSRF-Token', userCsrf)
      .send({
        checklistState: { offlineBackup: true, immutableSnapshot: true, mfaEnabled: true },
        canaryStatus: 'MONITORING_HEALTHY',
        markDrillCompleted: true,
      })
      .expect(201);
    expect(ransomRes.body.backupVerified).toBe(true);
    expect(ransomRes.body.readinessScore).toBeGreaterThanOrEqual(70);

    const caseRes = await adminAgent
      .post('/api/v1/forensics/cases')
      .set('X-CSRF-Token', adminCsrf)
      .send({
        title: 'Phishing Incident Forensic Review',
        description: 'Investigating high-risk phishing alert correlation',
        severity: 'HIGH',
      })
      .expect(201);

    const evRes = await adminAgent
      .post(`/api/v1/forensics/cases/${caseRes.body.id}/evidence`)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        label: 'Phishing Payload Header Dump',
        evidenceType: 'HTTP_TRACE',
        fileName: 'trace.txt',
        contentForHashing: 'GET /auth HTTP/1.1\r\nHost: verify-account-reset.example.invalid',
        storageLocation: 'SOC Locker #1',
      })
      .expect(201);
    expect(evRes.body.sha256Hash).toHaveLength(64);

    await adminAgent.get(`/api/v1/forensics/cases/${caseRes.body.id}/export`).expect(200);

    const alertsRes = await adminAgent.get('/api/v1/alerts').expect(200);
    expect(alertsRes.body.length).toBeGreaterThanOrEqual(1);

    const incRes = await adminAgent
      .post(`/api/v1/alerts/${alertsRes.body[0].id}/escalate`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(201);
    expect(incRes.body.incidentNumber).toMatch(/^INC-\d{4}-\d{4}$/);

    const csvReport = await auditorAgent.get('/api/v1/reports/admin-activity/export/csv').expect(200);
    expect(csvReport.text).toContain('FORENSIC_DOSSIER_EXPORTED');

    const pdfReport = await auditorAgent.get('/api/v1/reports/module-status/export/pdf').expect(200);
    expect(pdfReport.headers['content-type']).toContain('application/pdf');
  }, 30000);
});
