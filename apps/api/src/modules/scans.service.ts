import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { resolveMx, resolveNs, resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as tls from 'node:tls';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { validateSafeOutboundUrl } from '../common/security/ssrf.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { SocEventsGateway } from '../notifications/soc-events.gateway';

interface FindingItem {
  code: string;
  title: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detail: string;
  remediation?: string;
}

const SUSPICIOUS_TLDS = new Set([
  'zip',
  'mov',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'top',
  'xyz',
  'click',
  'work',
  'support',
]);

const BRAND_LURES = ['paypal', 'microsoft', 'google', 'apple', 'amazon', 'binance', 'chase', 'netflix'];

@Injectable()
export class ScansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly socGateway: SocEventsGateway,
  ) {}

  /**
   * MODULE 02 — SIS Phishing Shield
   * Performs IOC correlation, lexical/structural phishing heuristics, and optional external lookup.
   * Never claims a URL is guaranteed safe merely because no indicators matched.
   */
  async runPhishingScan(user: AuthenticatedUser, rawUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException('Enter a valid http:// or https:// URL.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http and https URLs can be evaluated.');
    }

    const hostname = parsed.hostname.toLowerCase();
    const normalizedUrl = parsed.toString().toLowerCase();

    const job = await this.prisma.scanJob.create({
      data: {
        organizationId: user.organizationId,
        requestedById: user.id,
        moduleCode: 'PHISHING_SHIELD',
        targetType: 'URL',
        targetValue: parsed.toString(),
        status: 'RUNNING',
      },
    });

    const findings: FindingItem[] = [];
    let riskScore = 0;

    // 1. Check Threat Intelligence IOC DB
    const iocMatches = await this.prisma.threatIndicator.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        OR: [
          { indicatorType: 'URL', value: normalizedUrl },
          { indicatorType: 'DOMAIN', value: hostname },
        ],
      },
      include: { source: true },
    });

    for (const match of iocMatches) {
      riskScore += match.severity === 'CRITICAL' ? 75 : match.severity === 'HIGH' ? 60 : 40;
      findings.push({
        code: 'IOC_FEED_MATCH',
        title: `Matched Threat Indicator (${match.threatCategory})`,
        severity: match.severity,
        detail: `Matched ${match.indicatorType} indicator from source "${match.source.name}" (confidence ${match.confidence}%).`,
        remediation: 'Do not visit or submit credentials to this URL; block domain on DNS/proxy.',
      });
    }

    // 2. Lexical & structural phishing heuristics
    if (parsed.username || parsed.password) {
      riskScore += 45;
      findings.push({
        code: 'EMBEDDED_CREDENTIALS',
        title: 'Userinfo (@) Obfuscation in URL',
        severity: 'HIGH',
        detail: 'URL contains embedded username/password syntax commonly used to spoof destinations.',
        remediation: 'Reject URLs containing @ credentials.',
      });
    }

    if (hostname.includes('xn--')) {
      riskScore += 35;
      findings.push({
        code: 'PUNYCODE_IDN',
        title: 'Internationalized Punycode Domain Detected',
        severity: 'MEDIUM',
        detail: `Hostname "${hostname}" uses punycode (xn--) which can facilitate homograph spoofing.`,
        remediation: 'Verify the exact legitimate domain before trusting.',
      });
    }

    if (isIP(hostname) !== 0) {
      riskScore += 35;
      findings.push({
        code: 'IP_LITERAL_HOST',
        title: 'Direct IP Address Host Used Instead of Domain',
        severity: 'MEDIUM',
        detail: 'Phishing kits frequently host lures directly on raw IP addresses.',
      });
    }

    const tld = hostname.split('.').pop() || '';
    if (SUSPICIOUS_TLDS.has(tld)) {
      riskScore += 20;
      findings.push({
        code: 'HIGH_ABUSE_TLD',
        title: `Elevated-Abuse Top-Level Domain (.${tld})`,
        severity: 'LOW',
        detail: `Domain uses .${tld}, frequently associated with disposable phishing infrastructure.`,
      });
    }

    const subdomainParts = hostname.split('.');
    if (subdomainParts.length >= 4) {
      riskScore += 15;
      findings.push({
        code: 'EXCESSIVE_SUBDOMAINS',
        title: 'Deep Subdomain Nesting',
        severity: 'LOW',
        detail: `Hostname contains ${subdomainParts.length} labels, sometimes used to mimic trusted brands.`,
      });
    }

    if (parsed.protocol === 'http:' && /(login|signin|verify|auth|wallet|password|bank)/i.test(parsed.pathname + parsed.search)) {
      riskScore += 25;
      findings.push({
        code: 'INSECURE_HTTP_AUTH_PATH',
        title: 'Unencrypted HTTP Authentication Path',
        severity: 'MEDIUM',
        detail: 'Authentication-themed path served over plaintext HTTP.',
        remediation: 'Never submit credentials over non-HTTPS links.',
      });
    }

    for (const brand of BRAND_LURES) {
      if (hostname.includes(brand) && !hostname.endsWith(`${brand}.com`)) {
        riskScore += 30;
        findings.push({
          code: 'BRAND_IMPERSONATION_KEYWORD',
          title: `Potential Brand Impersonation Keyword ("${brand}")`,
          severity: 'MEDIUM',
          detail: `Domain contains "${brand}" outside the primary ${brand}.com namespace.`,
        });
        break;
      }
    }

    // 3. Optional External Reputation Provider (VirusTotal / Google Safe Browsing)
    const vtKey = this.configService.get<string>('VIRUSTOTAL_API_KEY');
    const gsbKey = this.configService.get<string>('GOOGLE_SAFE_BROWSING_API_KEY');
    let providerStatus = 'LOCAL_IOC_AND_HEURISTICS_ONLY';
    let externalAttribution: Record<string, unknown> = {
      virustotal: vtKey ? 'CONFIGURED' : 'NOT_CONFIGURED',
      googleSafeBrowsing: gsbKey ? 'CONFIGURED' : 'NOT_CONFIGURED',
    };

    if (gsbKey) {
      try {
        const gsbRes = await fetch(
          `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(gsbKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client: { clientId: 'sis-cyber-fortress', clientVersion: '1.0.0' },
              threatInfo: {
                threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
                platformTypes: ['ANY_PLATFORM'],
                threatEntryTypes: ['URL'],
                threatEntries: [{ url: parsed.toString() }],
              },
            }),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (gsbRes.ok) {
          const gsbBody = (await gsbRes.json()) as { matches?: unknown[] };
          providerStatus = 'LOCAL_AND_GOOGLE_SAFE_BROWSING';
          if (gsbBody.matches && gsbBody.matches.length > 0) {
            riskScore += 70;
            findings.push({
              code: 'GSB_THREAT_MATCH',
              title: 'Google Safe Browsing Flagged URL',
              severity: 'CRITICAL',
              detail: 'Google Safe Browsing v4 returned an active threat match.',
            });
          }
        }
      } catch {
        externalAttribution = { ...externalAttribution, googleSafeBrowsing: 'LOOKUP_ERROR' };
      }
    }

    riskScore = Math.min(100, riskScore);
    const riskLevel =
      riskScore >= 60 ? 'HIGH_RISK' : riskScore >= 25 ? 'SUSPICIOUS' : 'NO_KNOWN_THREATS_FOUND';

    const verdictDisclaimer =
      riskLevel === 'NO_KNOWN_THREATS_FOUND'
        ? 'No known phishing indicators were detected in local IOC feeds or lexical checks at scan time. Absence of indicators does not guarantee the URL is safe.'
        : 'Suspicious or high-risk phishing indicators were detected. Avoid opening or entering credentials until verified.';

    const summary =
      findings.length === 0
        ? `0 risk indicators matched for ${hostname}.`
        : `${findings.length} risk indicator(s) detected for ${hostname} (score ${riskScore}/100).`;

    await this.prisma.scanJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', providerStatus, completedAt: new Date() },
    });

    const result = await this.prisma.scanResult.create({
      data: {
        scanJobId: job.id,
        riskLevel,
        riskScore,
        summary,
        verdictDisclaimer,
        findings: findings as unknown as Prisma.InputJsonValue,
        metadata: {
          hostname,
          checkedAt: new Date().toISOString(),
          providerStatus,
          externalAttribution,
        } as Prisma.InputJsonValue,
      },
      include: { scanJob: true },
    });

    if (riskLevel === 'HIGH_RISK' || riskLevel === 'SUSPICIOUS') {
      const mod = await this.prisma.securityModule.findUnique({
        where: { code: 'PHISHING_SHIELD' },
      });
      if (mod) {
        const alert = await this.prisma.securityAlert.create({
          data: {
            organizationId: user.organizationId,
            moduleId: mod.id,
            userId: user.id,
            title: `${riskLevel === 'HIGH_RISK' ? 'High-Risk' : 'Suspicious'} Phishing URL Detected: ${hostname}`,
            description: summary,
            severity: riskLevel === 'HIGH_RISK' ? 'HIGH' : 'MEDIUM',
            status: 'OPEN',
            category: 'PHISHING_DETECTION',
            sourceRef: `scan:${job.id}`,
          },
        });
        this.socGateway.emitOrgSocEvent(user.organizationId, 'alert:created', alert);

        await this.notificationsService.createAndDispatch({
          organizationId: user.organizationId,
          userId: user.id,
          title: `Phishing Shield Alert: ${hostname}`,
          message: summary,
          severity: riskLevel === 'HIGH_RISK' ? 'HIGH' : 'MEDIUM',
          moduleCode: 'PHISHING_SHIELD',
          deepLink: '/modules/phishing-shield',
          resourceType: 'ScanJob',
          resourceId: job.id,
        });
      }
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'PHISHING_URL_SCANNED',
      resourceType: 'ScanJob',
      resourceId: job.id,
      moduleCode: 'PHISHING_SHIELD',
      details: { hostname, riskLevel, riskScore },
    });

    return result;
  }

  async reportFalsePositive(user: AuthenticatedUser, scanResultId: string, reason: string) {
    const result = await this.prisma.scanResult.findFirst({
      where: {
        id: scanResultId,
        scanJob: { organizationId: user.organizationId },
      },
      include: { scanJob: true },
    });
    if (!result) throw new NotFoundException('Scan result not found.');

    const updated = await this.prisma.scanResult.update({
      where: { id: scanResultId },
      data: {
        falsePositiveReported: true,
        falsePositiveReason: reason,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'SCAN_FALSE_POSITIVE_REPORTED',
      resourceType: 'ScanResult',
      resourceId: scanResultId,
      moduleCode: result.scanJob.moduleCode,
      details: { reason },
    });

    return updated;
  }

  /**
   * MODULE 07 — SIS WebShield
   * Strictly enforces authorized & verified/approved RegisteredAsset scope + SSRF guard.
   */
  async runWebShieldScan(user: AuthenticatedUser, assetId: string) {
    const asset = await this.prisma.registeredAsset.findFirst({
      where: { id: assetId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Registered website asset not found.');

    if (!asset.isApprovedForScan || (asset.ownershipStatus !== 'VERIFIED' && asset.ownershipStatus !== 'APPROVED')) {
      await this.auditService.record({
        organizationId: user.organizationId,
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'WEBSHIELD_UNVERIFIED_SCAN_BLOCKED',
        resourceType: 'RegisteredAsset',
        resourceId: asset.id,
        moduleCode: 'WEBSHIELD',
        status: 'DENIED',
      });
      throw new ForbiddenException(
        'WebShield only scans verified or explicitly admin-approved domains. Complete ownership verification first.',
      );
    }

    const validated = await validateSafeOutboundUrl(asset.targetUrl);

    const job = await this.prisma.scanJob.create({
      data: {
        organizationId: user.organizationId,
        requestedById: user.id,
        moduleCode: 'WEBSHIELD',
        targetType: 'WEBSITE_ASSET',
        targetValue: asset.targetUrl,
        assetId: asset.id,
        status: 'RUNNING',
        providerStatus: 'AUTHORIZED_PASSIVE_INSPECTOR',
      },
    });

    const findings: FindingItem[] = [];
    const metadata: Record<string, unknown> = {
      domain: asset.domain,
      resolvedIps: validated.resolvedIps,
      checkedAt: new Date().toISOString(),
    };

    // 1. DNS Posture Checks (MX, NS, SPF, DMARC)
    const dnsSummary: Record<string, unknown> = {};
    try {
      const [txtRecords, dmarcRecords, mxRecords, nsRecords] = await Promise.allSettled([
        resolveTxt(asset.domain),
        resolveTxt(`_dmarc.${asset.domain}`),
        resolveMx(asset.domain),
        resolveNs(asset.domain),
      ]);

      const txtFlat = txtRecords.status === 'fulfilled' ? txtRecords.value.flat() : [];
      const hasSpf = txtFlat.some((t) => t.toLowerCase().startsWith('v=spf1'));
      const dmarcFlat = dmarcRecords.status === 'fulfilled' ? dmarcRecords.value.flat() : [];
      const hasDmarc = dmarcFlat.some((t) => t.toLowerCase().startsWith('v=dmarc1'));

      dnsSummary.hasSpf = hasSpf;
      dnsSummary.hasDmarc = hasDmarc;
      dnsSummary.mxCount = mxRecords.status === 'fulfilled' ? mxRecords.value.length : 0;
      dnsSummary.nsCount = nsRecords.status === 'fulfilled' ? nsRecords.value.length : 0;

      if (!hasSpf) {
        findings.push({
          code: 'DNS_MISSING_SPF',
          title: 'Missing SPF DNS Record',
          severity: 'LOW',
          detail: `No v=spf1 TXT record observed for ${asset.domain}.`,
          remediation: 'Publish an SPF TXT record if this domain sends or restricts email.',
        });
      }
      if (!hasDmarc) {
        findings.push({
          code: 'DNS_MISSING_DMARC',
          title: 'Missing DMARC Policy Record',
          severity: 'MEDIUM',
          detail: `No _dmarc.${asset.domain} policy record found.`,
          remediation: 'Add a _dmarc TXT policy (starting with p=quarantine or p=reject).',
        });
      }
    } catch {
      dnsSummary.status = 'DNS_UNAVAILABLE';
    }
    metadata.dns = dnsSummary;

    // 2. TLS Certificate Check (for HTTPS targets)
    if (validated.url.protocol === 'https:') {
      const tlsInfo = await this.inspectTlsCertificate(validated.hostname, validated.port);
      metadata.tls = tlsInfo;
      if (!tlsInfo.reachable) {
        findings.push({
          code: 'TLS_UNREACHABLE',
          title: 'TLS Handshake Unavailable',
          severity: 'HIGH',
          detail: tlsInfo.error || 'Unable to establish TLS connection to target.',
          remediation: 'Verify TLS listener and certificate chain availability.',
        });
      } else {
        if (!tlsInfo.authorized) {
          findings.push({
            code: 'TLS_UNTRUSTED_CERT',
            title: 'TLS Certificate Validation Failed',
            severity: 'HIGH',
            detail: `Certificate authorization failed: ${tlsInfo.authorizationError || 'unknown reason'}.`,
            remediation: 'Install a valid certificate chain signed by a trusted CA.',
          });
        }
        if (typeof tlsInfo.daysRemaining === 'number' && tlsInfo.daysRemaining < 21) {
          findings.push({
            code: 'TLS_EXPIRING_SOON',
            title: 'TLS Certificate Expiring Soon',
            severity: tlsInfo.daysRemaining <= 0 ? 'CRITICAL' : 'MEDIUM',
            detail: `Certificate expires in ${tlsInfo.daysRemaining} day(s).`,
            remediation: 'Renew TLS certificate automatically via ACME/CA.',
          });
        }
      }
    } else {
      findings.push({
        code: 'NO_HTTPS_SCHEME',
        title: 'Asset Registered Without HTTPS',
        severity: 'HIGH',
        detail: 'Target URL uses plaintext http:// instead of https://.',
        remediation: 'Enforce HTTPS with TLS 1.2/1.3 and HTTP-to-HTTPS redirect.',
      });
    }

    // 3. HTTP Security Headers Inspection (safe GET with manual redirects validated against SSRF)
    try {
      const headerAudit = await this.inspectHttpSecurityHeaders(asset.targetUrl);
      metadata.http = headerAudit;

      const requiredHeaders = [
        { key: 'strict-transport-security', title: 'Missing Strict-Transport-Security (HSTS)', severity: 'MEDIUM' as const },
        { key: 'content-security-policy', title: 'Missing Content-Security-Policy (CSP)', severity: 'MEDIUM' as const },
        { key: 'x-content-type-options', title: 'Missing X-Content-Type-Options', severity: 'LOW' as const },
        { key: 'x-frame-options', title: 'Missing X-Frame-Options / Clickjacking Protection', severity: 'LOW' as const },
        { key: 'referrer-policy', title: 'Missing Referrer-Policy Header', severity: 'LOW' as const },
      ];

      for (const reqHeader of requiredHeaders) {
        if (!headerAudit.headers[reqHeader.key]) {
          findings.push({
            code: `HEADER_${reqHeader.key.toUpperCase().replace(/-/g, '_')}`,
            title: reqHeader.title,
            severity: reqHeader.severity,
            detail: `Response from ${asset.domain} did not include ${reqHeader.key}.`,
            remediation: `Configure ${reqHeader.key} on web server or CDN edge.`,
          });
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'HTTP fetch failed.';
      metadata.http = { reachable: false, error: errMsg };
      findings.push({
        code: 'HTTP_TARGET_UNREACHABLE',
        title: 'Target HTTP Endpoint Unreachable',
        severity: 'MEDIUM',
        detail: `Live HTTP header inspection could not complete: ${errMsg}`,
        remediation: 'Verify outbound connectivity or target uptime before re-scanning.',
      });
    }

    const severityWeights = { CRITICAL: 35, HIGH: 25, MEDIUM: 12, LOW: 5, INFO: 0 };
    const riskScore = Math.min(
      100,
      findings.reduce((sum, f) => sum + severityWeights[f.severity], 0),
    );
    const riskLevel =
      riskScore >= 60 ? 'HIGH_RISK' : riskScore >= 25 ? 'MEDIUM_RISK' : 'LOW_RISK';

    await this.prisma.scanJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const scanResult = await this.prisma.scanResult.create({
      data: {
        scanJobId: job.id,
        riskLevel,
        riskScore,
        summary: `WebShield completed passive configuration scan for ${asset.domain}: ${findings.length} finding(s) recorded.`,
        verdictDisclaimer:
          'Authorized non-invasive TLS, DNS, and HTTP security header review only. Does not replace full authenticated penetration testing.',
        findings: findings as unknown as Prisma.InputJsonValue,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: { scanJob: true },
    });

    if (findings.some((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL')) {
      const mod = await this.prisma.securityModule.findUnique({ where: { code: 'WEBSHIELD' } });
      if (mod) {
        const alert = await this.prisma.securityAlert.create({
          data: {
            organizationId: user.organizationId,
            moduleId: mod.id,
            assetId: asset.id,
            userId: user.id,
            title: `WebShield High-Severity Finding on ${asset.domain}`,
            description: findings
              .filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL')
              .map((f) => f.title)
              .join('; '),
            severity: 'HIGH',
            status: 'OPEN',
            category: 'WEB_CONFIGURATION',
            sourceRef: `scan:${job.id}`,
          },
        });
        this.socGateway.emitOrgSocEvent(user.organizationId, 'alert:created', alert);
      }
    }

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'WEBSHIELD_SCAN_COMPLETED',
      resourceType: 'RegisteredAsset',
      resourceId: asset.id,
      moduleCode: 'WEBSHIELD',
      details: { domain: asset.domain, riskScore, findingCount: findings.length },
    });

    return scanResult;
  }

  async listScans(user: AuthenticatedUser, moduleCode?: string) {
    return this.prisma.scanJob.findMany({
      where: {
        organizationId: user.organizationId,
        ...(moduleCode ? { moduleCode } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        result: true,
        asset: { select: { id: true, name: true, domain: true, ownershipStatus: true } },
        requestedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  private inspectTlsCertificate(
    hostname: string,
    port: number,
  ): Promise<{
    reachable: boolean;
    authorized?: boolean;
    authorizationError?: string;
    protocol?: string | null;
    subject?: string;
    issuer?: string;
    validTo?: string;
    daysRemaining?: number;
    error?: string;
  }> {
    return new Promise((resolveTls) => {
      const socket = tls.connect(
        { host: hostname, port, servername: hostname, rejectUnauthorized: false, timeout: 5000 },
        () => {
          const cert = socket.getPeerCertificate();
          const protocol = socket.getProtocol();
          const authorized = socket.authorized;
          const authorizationError = socket.authorizationError
            ? String(socket.authorizationError)
            : undefined;
          let daysRemaining: number | undefined;
          if (cert.valid_to) {
            daysRemaining = Math.floor(
              (new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000,
            );
          }
          socket.end();
          const cn = cert.subject?.CN;
          const issuerVal = cert.issuer?.O || cert.issuer?.CN;
          resolveTls({
            reachable: true,
            authorized,
            authorizationError,
            protocol,
            subject: Array.isArray(cn) ? cn[0] : cn,
            issuer: Array.isArray(issuerVal) ? issuerVal[0] : issuerVal,
            validTo: cert.valid_to,
            daysRemaining,
          });
        },
      );
      socket.on('timeout', () => {
        socket.destroy();
        resolveTls({ reachable: false, error: 'TLS connection timed out (5s limit).' });
      });
      socket.on('error', (err) => {
        resolveTls({ reachable: false, error: err.message });
      });
    });
  }

  private async inspectHttpSecurityHeaders(initialUrl: string) {
    let currentUrl = initialUrl;
    let redirects = 0;

    while (redirects <= 3) {
      await validateSafeOutboundUrl(currentUrl);
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'SIS-Cyber-Fortress-WebShield/1.0 (Authorized-Check)' },
        signal: AbortSignal.timeout(5000),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).toString();
        redirects += 1;
        continue;
      }

      const headers: Record<string, string> = {};
      for (const key of [
        'strict-transport-security',
        'content-security-policy',
        'x-content-type-options',
        'x-frame-options',
        'referrer-policy',
        'permissions-policy',
        'server',
      ]) {
        const v = res.headers.get(key);
        if (v) headers[key] = v;
      }

      return {
        reachable: true,
        statusCode: res.status,
        finalUrl: currentUrl,
        redirectCount: redirects,
        headers,
      };
    }

    throw new BadRequestException('Too many HTTP redirects encountered during scan.');
  }
}
