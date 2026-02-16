import dotenv from 'dotenv';
import {z} from 'zod';
import path from "node:path";

const __dirname = path.resolve('./');
dotenv.config({ path: __dirname + '/.env' });

const Env = z.object({
    PORT: z.coerce.number(),
    BASE_URL: z.url(),
    BASE_DIR: z.string().default(''),
    MYSQL_HOST: z.string(),
    MYSQL_PORT: z.coerce.number().default(3306),
    MYSQL_USER: z.string(),
    MYSQL_PASSWORD: z.string(),
    MYSQL_DB: z.string(),
    MASTER_KEY_V1: z.string().regex(/^[0-9a-f]{64}$/i, 'MASTER_KEY_V1 must be 64 hex chars'),
    KEY_VERSION: z.coerce.number().int().positive(),
    LOG_LEVEL: z.enum(['trace','debug','info','warn','error','fatal']).optional(),
    SESSION_SECRET: z.string().min(32),
    SESSION_COOKIE_NAME: z.string().default('sid'),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800), // 7 days
    MAINTENANCE_MODE: z.coerce.number().default(0),
});

export const env = Env.parse(process.env);
