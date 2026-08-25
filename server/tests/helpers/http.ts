import type { Express } from 'express';
import request from 'supertest';

let ipCounter = 0;

/**
 * Une IP neuve par appel.
 *
 * Les 4 limiteurs de middleware/rateLimit.ts sont des singletons de module :
 * ils sont partagés par toutes les instances de createApp(), et leur store est
 * en mémoire pour toute la durée du process. Sans rotation d'IP, le 6ᵉ signup
 * de la suite prendrait un 429 — le limiteur d'inscription est à 5/heure.
 *
 * `app.set('trust proxy', TRUST_PROXY)` avec TRUST_PROXY=1 fait que `req.ip`
 * vaut la dernière entrée de X-Forwarded-For : la poser suffit à obtenir un
 * bucket vierge. Les tests qui doivent *vérifier* les 429 réutilisent au
 * contraire une IP fixe, cf. fixedIp().
 */
export function freshIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 0xff}.${(ipCounter >> 8) & 0xff}.${ipCounter & 0xff}`;
}

/** IP stable et unique, pour marteler délibérément un limiteur. */
export function fixedIp(label: string): string {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffff;
  return `172.${(hash >> 16) & 0xff}.${(hash >> 8) & 0xff}.${hash & 0xff}`;
}

export interface ClientOptions {
  /** Par défaut une IP neuve, donc des quotas de rate limit vierges. */
  ip?: string;
  /** En-tête Cookie complet, tel que renvoyé par cookieHeader(). */
  cookie?: string;
  /** PAT en clair, envoyé en `Authorization: Bearer`. */
  bearer?: string;
  /** En-tête Origin, pour les tests CORS. */
  origin?: string;
}

/**
 * Client HTTP de test : applique IP, cookie, bearer et origin sur chaque appel,
 * pour qu'aucun test n'oublie l'en-tête qui isole son rate limit.
 */
export function api(app: Express, opts: ClientOptions = {}) {
  const ip = opts.ip ?? freshIp();

  const decorate = (req: request.Test): request.Test => {
    req.set('X-Forwarded-For', ip);
    if (opts.cookie) req.set('Cookie', opts.cookie);
    if (opts.bearer) req.set('Authorization', `Bearer ${opts.bearer}`);
    if (opts.origin) req.set('Origin', opts.origin);
    return req;
  };

  const agent = request(app);

  return {
    ip,
    get: (url: string) => decorate(agent.get(url)),
    post: (url: string) => decorate(agent.post(url)),
    delete: (url: string) => decorate(agent.delete(url)),
    put: (url: string) => decorate(agent.put(url)),
    patch: (url: string) => decorate(agent.patch(url)),
    options: (url: string) => decorate(agent.options(url)),
  };
}

/**
 * Transforme un en-tête Set-Cookie de réponse en en-tête Cookie de requête.
 * Conserve tous les cookies (`sid`, et `tdc` si remember_device), en ne gardant
 * que la paire nom=valeur.
 */
export function cookieHeader(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** Récupère un cookie précis dans un Set-Cookie, valeur brute. */
export function readCookie(
  setCookie: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookie) return null;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of list) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0 && pair.slice(0, idx).trim() === name) return pair.slice(idx + 1);
  }
  return null;
}
