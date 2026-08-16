import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_BASE_URL: z.string().url(),
  FRONT_BASE_URL: z.string().url(),

  // Database
  MYSQL_HOST: z.string(),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string(),
  MYSQL_PASSWORD: z.string(),
  MYSQL_DB: z.string(),

  // Encryption
  MASTER_KEY_V1: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'MASTER_KEY_V1 must be 64 hex characters (256-bit)'),
  KEY_VERSION: z.coerce.number().int().positive(),

  // Privacy - HMAC secret for pseudonymizing IPs / emails in logs
  IP_HMAC_SECRET: z.string().min(32),

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().default('sid'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800), // 7 days

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // MFA / Trusted devices
  TRUSTED_DEVICE_COOKIE_NAME: z.string().default('tdc'),
  TRUSTED_DEVICE_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // CORS - comma-separated origin list, falls back to the built-in defaults when unset
  ALLOWED_ORIGINS: z.string().optional(),

  // Proxy chain - comma-separated Cloudflare CIDRs, falls back to the built-in
  // ranges when unset. Only requests coming from these edges may set CF-Connecting-IP.
  CLOUDFLARE_IPS: z.string().optional(),

  // Features
  MAINTENANCE_MODE: z.coerce.number().default(0),
});

export type Config = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);

export default config;
