import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import config from './env.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.MYSQL_HOST,
      port: config.MYSQL_PORT,
      user: config.MYSQL_USER,
      password: config.MYSQL_PASSWORD,
      database: config.MYSQL_DB,
      waitForConnections: true,
      connectionLimit: 10,
      multipleStatements: false,
      namedPlaceholders: true,
      dateStrings: true,
    });
  }
  return pool;
}

export async function withTx<T>(
  fn: (cx: PoolConnection) => Promise<T>,
): Promise<T> {
  const cx = await getPool().getConnection();
  try {
    await cx.beginTransaction();
    const res = await fn(cx);
    await cx.commit();
    return res;
  } catch (e) {
    await cx.rollback();
    throw e;
  } finally {
    cx.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
