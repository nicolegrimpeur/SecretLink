import net from 'node:net';
import { NextFunction, Request, Response } from 'express';
import ipaddr from 'ipaddr.js';

import config from '../config/env.js';
import { getLogger } from '../shared/logger.js';
import { hashIp } from '../shared/crypto.js';

const logger = getLogger('ClientIp');

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
    // A dual-stack socket reports IPv4 peers in mapped form (::ffff:162.158.23.21)
    if (v6.isIPv4MappedAddress()) {
      const mapped = v6.toIPv4Address();
      return CLOUDFLARE_RANGES.v4.some((range) => mapped.match(range));
    }
    return CLOUDFLARE_RANGES.v6.some((range) => v6.match(range));
  }

  return CLOUDFLARE_RANGES.v4.some((range) => (addr as ipaddr.IPv4).match(range));
}

/**
 * Resolve the real client IP when Cloudflare sits in front of the app.
 *
 * All visitors relayed by a same Cloudflare point of presence reach the app under
 * that edge address, which would make them share a rate-limit counter and collapse
 * onto a single audit-log IP hash. `CF-Connecting-IP` carries the origin address and
 * is promoted into `X-Forwarded-For` so req.ip, the rate limiters and the log hashes
 * all agree on it.
 *
 * The promotion is conditional on the peer - resolved through TRUST_PROXY, so not
 * forgeable - belonging to a published Cloudflare range. A client crafting the header
 * on its own is therefore ignored.
 *
 * Deployments without Cloudflare are unaffected: with no header, or a peer outside
 * those ranges, the address resolved from TRUST_PROXY is kept as-is.
 *
 * Must be registered before the HTTP logger and every rate limiter.
 */
export function resolveClientIp(req: Request, _res: Response, next: NextFunction): void {
  const peer = req.ip;
  // Snapshot before the promotion below overwrites the header.
  const forwardedForBefore = req.headers['x-forwarded-for'];

  if (peer && isCloudflareIp(peer)) {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    // Validate before trusting: the value ends up in log fields and rate-limit keys
    if (typeof cfConnectingIp === 'string' && net.isIP(cfConnectingIp)) {
      req.headers['x-forwarded-for'] = cfConnectingIp;
    }
  } else if (peer) {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    // Nothing to report when the chain already resolved to that same address: that is
    // Cloudflare sitting directly in front of the app, with no proxy in between, where
    // X-Forwarded-For alone already yields the right client.
    if (typeof cfConnectingIp === 'string' && cfConnectingIp !== peer) {
      warnUnknownCloudflarePeer(peer);
    }
  }

  logResolutionInClear(req, peer, forwardedForBefore);

  next();
}

/**
 * TEMPORAIRE - À SUPPRIMER après vérification de la bascule vers le point d'entrée
 * unique (cette fonction et son appel ci-dessus).
 *
 * Journalise la chaîne de résolution de l'IP client EN CLAIR, une ligne par requête.
 * Contourne délibérément la pseudonymisation appliquée partout ailleurs : lire les
 * adresses est justement l'objectif. Laissé en place, il écrit les adresses des
 * utilisateurs en clair dans les logs.
 *
 * Toutes les étapes sont journalisées, pas seulement l'adresse finale, parce qu'un
 * TRUST_PROXY erroné n'est visible que dans l'écart entre elles :
 *   - `socket_peer` : le pair TCP, X-Forwarded-For totalement ignoré. Derrière le
 *     nginx de la stack, c'est toujours le conteneur nginx.
 *   - `resolved_before_cf` : ce que donne TRUST_PROXY seul. Derrière Cloudflare, doit
 *     tomber sur un edge Cloudflare — c'est la condition de la promotion.
 *   - `resolved_ip` : la réponse finale, celle qu'utilisent les quotas et les hash
 *     d'audit. Doit être l'adresse du visiteur.
 * `ip_hash` est émis à côté pour recouper une ligne avec les lignes pseudonymisées,
 * et avec Get-IpHash.ps1.
 */
function logResolutionInClear(
  req: Request,
  resolvedBeforeCf: string | undefined,
  forwardedForBefore: string | string[] | undefined,
): void {
  logger.warn(
    {
      event: 'CLIENT_IP_DEBUG',
      trust_proxy: config.TRUST_PROXY,
      socket_peer: req.socket.remoteAddress ?? null,
      x_forwarded_for: forwardedForBefore ?? null,
      cf_connecting_ip: req.headers['cf-connecting-ip'] ?? null,
      resolved_before_cf: resolvedBeforeCf ?? null,
      resolved_ip: req.ip ?? null,
      ip_hash: hashIp(req.ip),
    },
    'TEMPORAIRE - IP client en clair, à retirer après vérification',
  );
}

/**
 * A CF-Connecting-IP coming from a peer we do not recognise as a Cloudflare edge.
 * Either someone is forging the header - it is ignored, as intended - or the
 * published ranges have moved and CLOUDFLARE_IPS needs refreshing. The second case
 * is silent otherwise: those clients would quietly fall back to being grouped by
 * edge address for rate limiting and audit hashes.
 *
 * The peer is hashed, never logged in clear: when the header is forged it is an end
 * user's address. Warning once per peer keeps a stale range list from flooding the
 * logs at full request rate, and the cap bounds memory against a rotating scanner.
 */
const warnedPeers = new Set<string>();
const MAX_WARNED_PEERS = 100;

function warnUnknownCloudflarePeer(peer: string): void {
  if (warnedPeers.has(peer) || warnedPeers.size >= MAX_WARNED_PEERS) return;
  warnedPeers.add(peer);

  logger.warn(
    { event: 'CF_PEER_NOT_RECOGNISED', ip_hash: hashIp(peer) },
    'CF-Connecting-IP received from a peer outside the configured Cloudflare ranges',
  );
}
