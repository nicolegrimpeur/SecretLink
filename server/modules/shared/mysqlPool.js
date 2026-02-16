import mysql from 'mysql2/promise';
import {env} from "./env.js";

export const pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: false,
    namedPlaceholders: true,
    dateStrings: true,
});

export async function withTx(fn) {
    const cx = await pool.getConnection();
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
