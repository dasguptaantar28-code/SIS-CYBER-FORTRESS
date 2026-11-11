export const ROLE_CODES = [
  'SUPER_ADMIN',
  'SECURITY_ADMIN',
  'MODULE_ADMIN',
  'AUDITOR',
  'REGULAR_USER',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard:read',
  MODULES_READ: 'modules:read',
  MODULES_MANAGE: 'modules:manage',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  DEVICES_READ: 'devices:read',
  DEVICES_MANAGE: 'devices:manage',
  ASSETS_READ: 'assets:read',
  ASSETS_MANAGE: 'assets:manage',
  SCANS_RUN: 'scans:run',
  ALERTS_READ: 'alerts:read',
  ALERTS_MANAGE: 'alerts:manage',
  INCIDENTS_READ: 'incidents:read',
  INCIDENTS_MANAGE: 'incidents:manage',
  FORENSICS_READ: 'forensics:read',
  FORENSICS_MANAGE: 'forensics:manage',
  FORENSICS_EXPORT: 'forensics:export',
  THREATS_READ: 'threats:read',
  THREATS_MANAGE: 'threats:manage',
  BACKUP_READ: 'backup:read',
  BACKUP_MANAGE: 'backup:manage',
  VAULT_OWN: 'vault:own',
  AUDIT_READ: 'audit:read',
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  SETTINGS_READ: 'settings:read',
  SETTINGS_MANAGE: 'settings:manage',
  NOTIFICATIONS_READ: 'notifications:read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_DEFAULT_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  SECURITY_ADMIN: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.MODULES_READ,
    PERMISSIONS.DEVICES_READ,
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.ASSETS_MANAGE,
    PERMISSIONS.SCANS_RUN,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.ALERTS_MANAGE,
    PERMISSIONS.INCIDENTS_READ,
    PERMISSIONS.INCIDENTS_MANAGE,
    PERMISSIONS.FORENSICS_READ,
    PERMISSIONS.FORENSICS_MANAGE,
    PERMISSIONS.FORENSICS_EXPORT,
    PERMISSIONS.THREATS_READ,
    PERMISSIONS.THREATS_MANAGE,
    PERMISSIONS.BACKUP_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.VAULT_OWN,
  ],
  MODULE_ADMIN: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.MODULES_READ,
    PERMISSIONS.MODULES_MANAGE,
    PERMISSIONS.DEVICES_READ,
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.SCANS_RUN,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.ALERTS_MANAGE,
    PERMISSIONS.INCIDENTS_READ,
    PERMISSIONS.THREATS_READ,
    PERMISSIONS.BACKUP_READ,
    PERMISSIONS.BACKUP_MANAGE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.VAULT_OWN,
  ],
  AUDITOR: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.MODULES_READ,
    PERMISSIONS.DEVICES_READ,
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.INCIDENTS_READ,
    PERMISSIONS.FORENSICS_READ,
    PERMISSIONS.THREATS_READ,
    PERMISSIONS.BACKUP_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.VAULT_OWN,
  ],
  REGULAR_USER: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.MODULES_READ,
    PERMISSIONS.DEVICES_READ,
    PERMISSIONS.DEVICES_MANAGE,
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.ASSETS_MANAGE,
    PERMISSIONS.SCANS_RUN,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.THREATS_READ,
    PERMISSIONS.BACKUP_READ,
    PERMISSIONS.BACKUP_MANAGE,
    PERMISSIONS.VAULT_OWN,
    PERMISSIONS.NOTIFICATIONS_READ,
  ],
};

export const MODULE_SLUGS = [
  'identity-guardian',
  'phishing-shield',
  'endpoint-guardian',
  'network-sentinel',
  'vault-guardian',
  'ransomware-guardian',
  'webshield',
  'digital-forensics',
  'access-guardian',
  'threat-intelligence',
  'cloud-backup',
  'cyber-soc',
] as const;

export type ModuleSlug = (typeof MODULE_SLUGS)[number];

export interface SecurityModuleDefinition {
  code: string;
  slug: ModuleSlug;
  number: string;
  name: string;
  shortName: string;
  category: 'IDENTITY' | 'ENDPOINT' | 'NETWORK' | 'DATA' | 'WEB' | 'OPERATIONS';
  description: string;
  platformSupport: 'ALL' | 'ANDROID_FOCUSED' | 'WEB_AND_API';
}

export const SECURITY_MODULES: SecurityModuleDefinition[] = [
  {
    code: 'IDENTITY_GUARDIAN',
    slug: 'identity-guardian',
    number: '01',
    name: 'SIS Identity Guardian',
    shortName: 'Identity Guardian',
    category: 'IDENTITY',
    description:
      'Digital identity protection, TOTP MFA, passkey-ready auth, login telemetry, and k-anonymity breach checks.',
    platformSupport: 'ALL',
  },
  {
    code: 'PHISHING_SHIELD',
    slug: 'phishing-shield',
    number: '02',
    name: 'SIS Phishing Shield',
    shortName: 'Phishing Shield',
    category: 'WEB',
    description:
      'URL/domain phishing analysis, IOC matching, lexical risk scoring, false-positive appeals, and threat reporting.',
    platformSupport: 'ALL',
  },
  {
    code: 'ENDPOINT_GUARDIAN',
    slug: 'endpoint-guardian',
    number: '03',
    name: 'SIS Endpoint Guardian',
    shortName: 'Endpoint Guardian',
    category: 'ENDPOINT',
    description:
      'Android device registration, posture evaluation, permitted app & permission overview, and compliance tracking.',
    platformSupport: 'ANDROID_FOCUSED',
  },
  {
    code: 'NETWORK_SENTINEL',
    slug: 'network-sentinel',
    number: '04',
    name: 'SIS Network Sentinel',
    shortName: 'Network Sentinel',
    category: 'NETWORK',
    description:
      'Network & Wi-Fi security awareness, open/unsafe network alerts, OS capability disclosures, and risk checklists.',
    platformSupport: 'ANDROID_FOCUSED',
  },
  {
    code: 'VAULT_GUARDIAN',
    slug: 'vault-guardian',
    number: '05',
    name: 'SIS Vault Guardian',
    shortName: 'Vault Guardian',
    category: 'DATA',
    description:
      'Zero-knowledge client-side AES-256-GCM password, note, and document vault with biometric/PIN unlock.',
    platformSupport: 'ALL',
  },
  {
    code: 'RANSOMWARE_GUARDIAN',
    slug: 'ransomware-guardian',
    number: '06',
    name: 'SIS Ransomware Guardian',
    shortName: 'Ransomware Guardian',
    category: 'DATA',
    description:
      'Defensive ransomware readiness, backup verification posture, safe file-change indicators, and recovery playbooks.',
    platformSupport: 'ALL',
  },
  {
    code: 'WEBSHIELD',
    slug: 'webshield',
    number: '07',
    name: 'SIS WebShield',
    shortName: 'WebShield',
    category: 'WEB',
    description:
      'Authorized website monitoring: ownership verification, TLS certificates, DNS SPF/DMARC, and security headers.',
    platformSupport: 'WEB_AND_API',
  },
  {
    code: 'DIGITAL_FORENSICS',
    slug: 'digital-forensics',
    number: '08',
    name: 'SIS Digital Forensics',
    shortName: 'Digital Forensics',
    category: 'OPERATIONS',
    description:
      'Incident case management, evidence SHA-256 integrity, immutable chain-of-custody logs, and controlled exports.',
    platformSupport: 'WEB_AND_API',
  },
  {
    code: 'ACCESS_GUARDIAN',
    slug: 'access-guardian',
    number: '09',
    name: 'SIS Access Guardian',
    shortName: 'Access Guardian',
    category: 'IDENTITY',
    description:
      'RBAC role & permission governance, active session tracking, remote session revocation, and access audits.',
    platformSupport: 'ALL',
  },
  {
    code: 'THREAT_INTELLIGENCE',
    slug: 'threat-intelligence',
    number: '10',
    name: 'SIS Threat Intelligence',
    shortName: 'Threat Intelligence',
    category: 'OPERATIONS',
    description:
      'IOC management (domains, URLs, IPs, file hashes), feed attribution, freshness monitoring, and severity tagging.',
    platformSupport: 'ALL',
  },
  {
    code: 'CLOUD_BACKUP',
    slug: 'cloud-backup',
    number: '11',
    name: 'SIS Cloud Backup Guardian',
    shortName: 'Cloud Backup Guardian',
    category: 'DATA',
    description:
      'Scheduled encrypted backups, SHA-256 integrity verification, retention governance, and guided restore workflows.',
    platformSupport: 'ALL',
  },
  {
    code: 'CYBER_SOC',
    slug: 'cyber-soc',
    number: '12',
    name: 'SIS Cyber SOC',
    shortName: 'Cyber SOC',
    category: 'OPERATIONS',
    description:
      'Centralized Security Operations Center correlating alerts, incidents, analytics, SLA workflows, and audit trails.',
    platformSupport: 'ALL',
  },
];

export type SeverityLevel = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'CLOSED';
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNCONFIGURED';
