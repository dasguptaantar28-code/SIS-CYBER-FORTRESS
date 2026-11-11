import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr4(ip: string, base: string, maskBits: number): boolean {
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();

  // Strip IPv6 zone index if present
  const cleanIp = ip.includes('%') ? ip.split('%')[0] : ip;
  const version = isIP(cleanIp);
  if (version === 0) return true;

  if (version === 4) {
    return (
      inCidr4(cleanIp, '0.0.0.0', 8) || // "This" network
      inCidr4(cleanIp, '10.0.0.0', 8) || // RFC1918
      inCidr4(cleanIp, '100.64.0.0', 10) || // CGNAT RFC6598
      inCidr4(cleanIp, '127.0.0.0', 8) || // Loopback
      inCidr4(cleanIp, '169.254.0.0', 16) || // Link-local / Cloud metadata
      inCidr4(cleanIp, '172.16.0.0', 12) || // RFC1918
      inCidr4(cleanIp, '192.0.0.0', 24) || // IETF protocol assignments
      inCidr4(cleanIp, '192.0.2.0', 24) || // TEST-NET-1
      inCidr4(cleanIp, '192.168.0.0', 16) || // RFC1918
      inCidr4(cleanIp, '198.18.0.0', 15) || // Benchmark
      inCidr4(cleanIp, '198.51.100.0', 24) || // TEST-NET-2
      inCidr4(cleanIp, '203.0.113.0', 24) || // TEST-NET-3
      inCidr4(cleanIp, '224.0.0.0', 4) || // Multicast
      inCidr4(cleanIp, '240.0.0.0', 4) // Reserved / Broadcast
    );
  }

  // IPv6 checks
  if (cleanIp === '::' || cleanIp === '::1') return true;
  if (cleanIp.startsWith('::ffff:')) {
    const mappedV4 = cleanIp.slice(7);
    if (isIP(mappedV4) === 4) return isPrivateOrReservedIp(mappedV4);
  }
  // fc00::/7 Unique local, fe80::/10 Link-local, ff00::/8 Multicast
  if (/^(fc|fd|fe8|fe9|fea|feb|ff)/i.test(cleanIp)) return true;
  if (cleanIp.startsWith('2001:db8:')) return true; // Documentation

  return false;
}

export interface ValidatedExternalTarget {
  url: URL;
  hostname: string;
  resolvedIps: string[];
  port: number;
}

export async function validateSafeOutboundUrl(rawUrl: string): Promise<ValidatedExternalTarget> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new BadRequestException('Invalid URL format.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ForbiddenException('Only http and https schemes are permitted.');
  }
  if (parsed.username || parsed.password) {
    throw new ForbiddenException('Credentials in URLs are prohibited.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new ForbiddenException('Target hostname is blocked by SSRF policy.');
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  if (![80, 443].includes(port)) {
    throw new ForbiddenException('Only standard web ports (80, 443) are permitted by WebShield scan policy.');
  }

  if (isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new ForbiddenException('Target IP falls inside a restricted or private network range.');
    }
    return { url: parsed, hostname, resolvedIps: [hostname], port };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new BadRequestException(`DNS resolution failed for host "${hostname}".`);
  }

  if (!records || records.length === 0) {
    throw new BadRequestException(`No DNS records resolved for host "${hostname}".`);
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new ForbiddenException(
        `DNS resolution returned private or restricted IP (${record.address}); outbound connection blocked.`,
      );
    }
  }

  return {
    url: parsed,
    hostname,
    resolvedIps: records.map((r) => r.address),
    port,
  };
}
