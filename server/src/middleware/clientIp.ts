import net from 'node:net';
import { NextFunction, Request, Response } from 'express';
import ipaddr from 'ipaddr.js';

import config from '../config/env.js';

/**
 * Cloudflare edge ranges - https://www.cloudflare.com/ips/
 * Overridable without a rebuild via CLOUDFLARE_IPS (comma-separated CIDRs) when
 * Cloudflare publishes new ranges.
 */
const DEFAULT_CLOUDFLARE_CIDRS = [
  // IPv4
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  // IPv6
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

type V4Range = [ipaddr.IPv4, number];
type V6Range = [ipaddr.IPv6, number];

/**
 * Split the CIDR list by family - ipaddr's `match` throws when comparing an IPv4
 * address against an IPv6 range, so the two are never mixed.
 */
function compileRanges(cidrs: string[]): { v4: V4Range[]; v6: V6Range[] } {
  const v4: V4Range[] = [];
  const v6: V6Range[] = [];

  for (const cidr of cidrs) {
    let parsed: [ipaddr.IPv4 | ipaddr.IPv6, number];
    try {
      parsed = ipaddr.parseCIDR(cidr);
    } catch {
      // Fail fast at boot rather than silently shipping a narrower allowlist,
      // which would degrade every client IP to a Cloudflare edge address.
      throw new Error(`Invalid Cloudflare CIDR in CLOUDFLARE_IPS: "${cidr}"`);
    }

    if (parsed[0].kind() === 'ipv4') v4.push(parsed as V4Range);
    else v6.push(parsed as V6Range);
  }

  return { v4, v6 };
}

/** CLOUDFLARE_IPS (comma-separated) when set, the built-in ranges otherwise. */
function resolveCloudflareCidrs(): string[] {
  const fromEnv = (config.CLOUDFLARE_IPS ?? '')
    .split(',')
    .map((cidr) => cidr.trim())
    .filter(Boolean);

  return fromEnv.length ? fromEnv : DEFAULT_CLOUDFLARE_CIDRS;
}

const CLOUDFLARE_RANGES = compileRanges(resolveCloudflareCidrs());

/** True when `ip` belongs to a published Cloudflare edge range. */
export function isCloudflareIp(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return false;
  }

  if (addr.kind() === 'ipv6') {
    const v6 = addr as ipaddr.IPv6;
    // Traefik may hand us IPv4-mapped forms such as ::ffff:162.158.23.21
    if (v6.isIPv4MappedAddress()) {
      const mapped = v6.toIPv4Address();
      return CLOUDFLARE_RANGES.v4.some((range) => mapped.match(range));
    }
    return CLOUDFLARE_RANGES.v6.some((range) => v6.match(range));
  }

  return CLOUDFLARE_RANGES.v4.some((range) => (addr as ipaddr.IPv4).match(range));
}

/**
 * Resolve the real client IP behind the Cloudflare -> Traefik chain.
 *
 * Traefik overwrites `X-Forwarded-For` with the peer it actually saw, so with
 * `trust proxy = 1` req.ip is that peer - authentic, and not forgeable by a
 * client. When (and only when) that peer is a Cloudflare edge, `CF-Connecting-IP`
 * is the origin of the request and is promoted into XFF so that req.ip, the rate
 * limiters and the audit-log IP hashes all see the same, correct address.
 *
 * A request reaching Traefik directly keeps its own IP: the forged header is
 * ignored because the peer is not Cloudflare.
 *
 * Must be registered before the HTTP logger and every rate limiter.
 */
export function resolveClientIp(req: Request, _res: Response, next: NextFunction): void {
  const peer = req.ip;

  if (peer && isCloudflareIp(peer)) {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    // Validate before trusting: the value ends up in log fields and rate-limit keys
    if (typeof cfConnectingIp === 'string' && net.isIP(cfConnectingIp)) {
      req.headers['x-forwarded-for'] = cfConnectingIp;
    }
  }

  next();
}
