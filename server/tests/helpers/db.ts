import { closePool, getPool } from '../../src/config/database.js';

/**
 * Toutes les FK du schéma pointent vers `users.id` en ON DELETE CASCADE, et il
 * n'y a aucune dépendance croisée entre les tables filles. On les vide donc
 * avant `users`, la désactivation des contraintes servant de ceinture.
 */
const TABLES = [
  'trusted_devices',
  'recovery_codes',
  'api_tokens',
  'links',
  'items',
  'users',
] as const;

/** Id de l'utilisateur anonyme partagé, cf. deploy/mysql-init/02-seed-data.sql. */
export const ANONYMOUS_USER_ID = 1;

/**
 * Remet la base à l'état d'un `docker compose up` neuf.
 *
 * La réinsertion de `users(id=1)` n'est pas cosmétique : `POST /links` écrit
 * `owner_user_id = 1` en dur, et viole la contrainte `fk_links_owner` sans
 * cette ligne - l'endpoint répondrait 500 au lieu de 201.
 *
 * TRUNCATE remet aussi l'AUTO_INCREMENT à 1, donc les utilisateurs créés
 * ensuite reçoivent des ids déterministes (2, 3, …) d'un test à l'autre.
 */
export async function resetDb(): Promise<void> {
  const pool = getPool();

  // `query` et non `execute` : TRUNCATE et SET ne passent pas par des requêtes
  // préparées côté MySQL.
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await pool.query(`TRUNCATE TABLE \`${table}\``);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  await pool.query('INSERT INTO `users` (`id`, `email`) VALUES (?, ?)', [
    ANONYMOUS_USER_ID,
    'anonymous@nicob.ovh',
  ]);
}

/** À appeler dans un afterAll, sinon le pool garde le process en vie. */
export async function closeDb(): Promise<void> {
  await closePool();
}

/** Échappatoire pour les assertions qui doivent regarder l'état réel en base. */
export async function queryRows<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}
