import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import config from './env.js';

/**
 * Ligne de résultat typée, pour `execute<Row<T>[]>()`. mysql2 exige un type qui
 * étende RowDataPacket ; l'intersection garde leur type aux colonnes déclarées
 * dans T, seules les autres retombent sur l'index `any` de RowDataPacket.
 */
export type Row<T> = T & RowDataPacket;

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
      timezone: 'Z',
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
