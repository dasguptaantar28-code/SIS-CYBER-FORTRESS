import { PrismaClient } from '@prisma/client';
import {
  PERMISSIONS,
  ROLE_CODES,
  ROLE_DEFAULT_PERMISSIONS,
  RoleCode,
  SECURITY_MODULES,
} from '@sis/shared-contracts';
import { hashSecretArgon2id, sha256Hex } from '../src/common/security/crypto.util';

const prisma = new PrismaClient();

const ROLE_META: Record<RoleCode, { name: string; description: string }> = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full authorized platform administration across users, roles, modules, assets, and SOC telemetry.',
  },
  SECURITY_ADMIN: {
    name: 'Security Admin',
    description: 'Manages security alerts, incidents, threat intelligence feeds, and forensic cases.',
  },
  MODULE_ADMIN: {
    name: 'Module Admin',
    description: 'Administers security modules, module-specific findings, and backup workflows.',
  },
  AUDITOR: {
    name: 'Auditor',
    description: 'Read-only access to security records, audit logs, compliance reports, and evidence exports.',
  },
  REGULAR_USER: {
    name: 'Regular User',
    description: 'Accesses personal security posture, phishing scanner, own devices, vault, and encrypted backups.',
  },
};

export async function runSeed(client: PrismaClient = prisma): Promise<void> {
  const org = await client.organization.upsert({
    where: { slug: 'sis-enterprise' },
    update: {},
    create: {
      name: 'SIS Cyber Fortress Enterprise',
      slug: 'sis-enterprise',
      planTier: 'ENTERPRISE',
    },
  });

  // 1. Seed Permissions
  const permissionRecords = new Map<string, string>();
  for (const code of Object.values(PERMISSIONS)) {
    const [category, action] = code.split(':');
    const perm = await client.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: `${category.toUpperCase()} ${action.toUpperCase()}`,
        category: category.toUpperCase(),
        description: `Permits ${action} operations on ${category}.`,
      },
    });
    permissionRecords.set(code, perm.id);
  }

  // 2. Seed Roles & RolePermissions
  const roleRecords = new Map<RoleCode, string>();
  for (const roleCode of ROLE_CODES) {
    const meta = ROLE_META[roleCode];
    const role = await client.role.upsert({
      where: { code: roleCode },
      update: { name: meta.name, description: meta.description },
      create: {
        code: roleCode,
        name: meta.name,
        description: meta.description,
        isSystem: true,
      },
    });
    roleRecords.set(roleCode, role.id);

    for (const permCode of ROLE_DEFAULT_PERMISSIONS[roleCode]) {
      const permId = permissionRecords.get(permCode);
      if (!permId) continue;
      await client.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      });
    }
  }

  // 3. Seed all 12 Security Modules & baseline statuses
  const moduleIdByCode = new Map<string, string>();
  for (const mod of SECURITY_MODULES) {
    const saved = await client.securityModule.upsert({
      where: { code: mod.code },
      update: {
        name: mod.name,
        shortName: mod.shortName,
        description: mod.description,
        category: mod.category,
        platformSupport: mod.platformSupport,
        number: mod.number,
        slug: mod.slug,
      },
      create: {
        code: mod.code,
        slug: mod.slug,
        number: mod.number,
        name: mod.name,
        shortName: mod.shortName,
        category: mod.category,
        description: mod.description,
        platformSupport: mod.platformSupport,
        isEnabled: true,
      },
    });
    moduleIdByCode.set(mod.code, saved.id);

    await client.moduleStatus.upsert({
      where: { organizationId_moduleId: { organizationId: org.id, moduleId: saved.id } },
      update: {},
      create: {
        organizationId: org.id,
        moduleId: saved.id,
        healthStatus: 'HEALTHY',
        postureScore: 100,
        activeIssues: 0,
        details: { initializedAt: new Date().toISOString(), mode: 'baseline' },
      },
    });
  }

  // 4. Integration Status (honest disclosure of configured vs unconfigured external integrations)
  const integrations = [
    {
      serviceKey: 'postgresql_db',
      displayName: 'PostgreSQL Primary Store',
      category: 'DATABASE',
      status: 'HEALTHY',
      configured: true,
      details: 'Connected via Prisma ORM.',
    },
    {
      serviceKey: 'hibp_k_anon',
      displayName: 'HIBP Pwned Passwords (k-Anonymity)',
      category: 'IDENTITY',
      status: process.env.HIBP_ENABLED === 'true' ? 'CONFIGURED' : 'LOCAL_ONLY',
      configured: process.env.HIBP_ENABLED === 'true',
      details:
        process.env.HIBP_ENABLED === 'true'
          ? 'External k-anonymity 5-char SHA-1 prefix API enabled.'
          : 'Running in offline k-anonymity local check mode (external HIBP API disabled).',
    },
    {
      serviceKey: 'virustotal',
      displayName: 'VirusTotal Reputation Feed',
      category: 'THREAT_INTEL',
      status: process.env.VIRUSTOTAL_API_KEY ? 'CONFIGURED' : 'UNCONFIGURED',
      configured: Boolean(process.env.VIRUSTOTAL_API_KEY),
      details: process.env.VIRUSTOTAL_API_KEY
        ? 'API key configured for external URL/domain lookups.'
        : 'No VIRUSTOTAL_API_KEY configured; Phishing Shield uses local IOC + heuristic engine.',
    },
    {
      serviceKey: 'google_safe_browsing',
      displayName: 'Google Safe Browsing API',
      category: 'THREAT_INTEL',
      status: process.env.GOOGLE_SAFE_BROWSING_API_KEY ? 'CONFIGURED' : 'UNCONFIGURED',
      configured: Boolean(process.env.GOOGLE_SAFE_BROWSING_API_KEY),
      details: process.env.GOOGLE_SAFE_BROWSING_API_KEY
        ? 'Safe Browsing v4 lookup enabled.'
        : 'No GOOGLE_SAFE_BROWSING_API_KEY configured.',
    },
    {
      serviceKey: 'firebase_fcm',
      displayName: 'Firebase Cloud Messaging (FCM)',
      category: 'NOTIFICATIONS',
      status:
        process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY
          ? 'CONFIGURED'
          : 'UNCONFIGURED',
      configured: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY),
      details:
        process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY
          ? 'FCM HTTP v1 push notifications active.'
          : 'FCM credentials absent; WebSocket + database notification center active.',
    },
  ];

  for (const item of integrations) {
    await client.integrationStatus.upsert({
      where: { organizationId_serviceKey: { organizationId: org.id, serviceKey: item.serviceKey } },
      update: { status: item.status, configured: item.configured, details: item.details },
      create: { organizationId: org.id, ...item },
    });
  }

  // 5. Threat Intelligence baseline local source
  const localFeed = await client.threatSource.upsert({
    where: { organizationId_providerKey: { organizationId: org.id, providerKey: 'sis-local-ioc' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'SIS Curated Baseline IOC Registry',
      providerKey: 'sis-local-ioc',
      feedType: 'INTERNAL',
      status: 'ACTIVE',
      isConfigured: true,
      lastSyncedAt: new Date(),
      recordCount: 0,
    },
  });

  // 6. Optional clearly labeled Development Demo Seed Data (NEVER runs in production)
  const isDevDemoAllowed =
    process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_SEED === 'true';

  if (isDevDemoAllowed) {
    const adminEmail = process.env.DEMO_SUPER_ADMIN_EMAIL || 'admin@sisfortress.local';
    const adminPass = process.env.DEMO_SUPER_ADMIN_PASSWORD || 'ChangeMe@2026!';

    const demoAccounts: Array<{ email: string; fullName: string; role: RoleCode; password: string }> = [
      { email: adminEmail, fullName: 'Antar Dasgupta (Demo Super Admin)', role: 'SUPER_ADMIN', password: adminPass },
      { email: 'secadmin@sisfortress.local', fullName: 'Nadia Rahman (Demo Security Admin)', role: 'SECURITY_ADMIN', password: adminPass },
      { email: 'modadmin@sisfortress.local', fullName: 'Tariq Hasan (Demo Module Admin)', role: 'MODULE_ADMIN', password: adminPass },
      { email: 'auditor@sisfortress.local', fullName: 'Farhana Karim (Demo Auditor)', role: 'AUDITOR', password: adminPass },
      { email: 'analyst@sisfortress.local', fullName: 'Rafi Ahmed (Demo User)', role: 'REGULAR_USER', password: adminPass },
    ];

    let superAdminId = '';
    for (const acc of demoAccounts) {
      const passwordHash = await hashSecretArgon2id(acc.password);
      const user = await client.user.upsert({
        where: { email: acc.email },
        update: {},
        create: {
          organizationId: org.id,
          email: acc.email,
          fullName: acc.fullName,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      if (acc.role === 'SUPER_ADMIN') superAdminId = user.id;

      const roleId = roleRecords.get(acc.role);
      if (roleId) {
        await client.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId } },
          update: {},
          create: { userId: user.id, roleId },
        });
      }
    }

    // Seed sample IOC indicators (clearly tagged as RFC test/demo indicators)
    const demoIndicators = [
      {
        indicatorType: 'DOMAIN',
        value: 'phish-login-demo.example.invalid',
        threatCategory: 'PHISHING',
        severity: 'HIGH' as const,
        confidence: 92,
        tags: ['demo-seed', 'credential-harvest'],
        description: 'Demo RFC-2606 .invalid phishing domain fixture for Phishing Shield testing.',
      },
      {
        indicatorType: 'URL',
        value: 'http://verify-account-reset.example.invalid/auth',
        threatCategory: 'PHISHING',
        severity: 'CRITICAL' as const,
        confidence: 95,
        tags: ['demo-seed', 'oauth-lure'],
        description: 'Demo RFC-2606 .invalid phishing URL fixture.',
      },
      {
        indicatorType: 'IP',
        value: '198.51.100.42',
        threatCategory: 'BOTNET_C2',
        severity: 'HIGH' as const,
        confidence: 85,
        tags: ['demo-seed', 'rfc5737-test-net-2'],
        description: 'Documentation TEST-NET-2 IP fixture for IOC lookup validation.',
      },
      {
        indicatorType: 'HASH',
        value: sha256Hex('sis-cyber-fortress-eicar-benign-test-fixture'),
        threatCategory: 'MALWARE_SAMPLE_HASH',
        severity: 'MEDIUM' as const,
        confidence: 88,
        tags: ['demo-seed', 'benign-hash-fixture'],
        description: 'Benign SHA-256 test hash fixture.',
      },
    ];

    for (const ioc of demoIndicators) {
      await client.threatIndicator.upsert({
        where: {
          organizationId_indicatorType_value: {
            organizationId: org.id,
            indicatorType: ioc.indicatorType,
            value: ioc.value,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          sourceId: localFeed.id,
          ...ioc,
        },
      });
    }

    await client.threatSource.update({
      where: { id: localFeed.id },
      data: { recordCount: demoIndicators.length, lastSyncedAt: new Date() },
    });

    // Seed 1 verified demo asset & 1 sample device if none exist
    const existingAssets = await client.registeredAsset.count({ where: { organizationId: org.id } });
    if (existingAssets === 0 && superAdminId) {
      await client.registeredAsset.create({
        data: {
          organizationId: org.id,
          createdById: superAdminId,
          name: 'SIS Example Public Reference Portal (Demo)',
          assetType: 'WEBSITE',
          targetUrl: 'https://example.com',
          domain: 'example.com',
          ownershipStatus: 'APPROVED',
          verificationMethod: 'ADMIN_APPROVAL_DEMO',
          verificationToken: 'sis-demo-verified-token',
          verifiedAt: new Date(),
          isApprovedForScan: true,
          notes: 'Development demo approved target using RFC 2606 example.com.',
        },
      });
    }

    const existingAlerts = await client.securityAlert.count({ where: { organizationId: org.id } });
    const socModuleId = moduleIdByCode.get('CYBER_SOC');
    if (existingAlerts === 0 && socModuleId && superAdminId) {
      await client.securityAlert.create({
        data: {
          organizationId: org.id,
          moduleId: socModuleId,
          userId: superAdminId,
          title: '[Demo Seed] Baseline SOC Telemetry Initialized',
          description:
            'Development demo environment initialized. Configure real targets, devices, and scans to generate live SOC telemetry.',
          severity: 'INFO',
          status: 'ACKNOWLEDGED',
          category: 'SYSTEM_BASELINE',
          sourceRef: 'seed:dev-demo',
        },
      });
    }
  }
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      console.log('SIS Cyber Fortress database seed completed.');
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
