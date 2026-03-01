import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  BASE_URL: z.string().url(),

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

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().default('sid'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800), // 7 days

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // Features
  MAINTENANCE_MODE: z.coerce.number().default(0),
  RATE_LIMIT_ENABLED: z.coerce.number().default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export type Config = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);

// Validate critical configs
if (process.env.NODE_ENV === 'production') {
  if (!config.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required in production');
  }
  if (!config.MASTER_KEY_V1) {
    throw new Error('MASTER_KEY_V1 is required in production');
  }
}

export default config;
