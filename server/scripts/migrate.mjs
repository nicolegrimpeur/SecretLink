#!/usr/bin/env node
/**
 * Applique les migrations de schéma en attente.
 *
 *     node scripts/migrate.mjs            applique ce qui manque
 *     node scripts/migrate.mjs --status   liste sans rien appliquer
 *
 * Pourquoi un runner maison plutôt qu'un outil du marché : les outils SQL
 * généralistes se configurent par une `DATABASE_URL` unique, or le mot de passe
 * MySQL de production est aléatoire et peut contenir `/`, `+` ou `@` - des
 * caractères qui cassent ou déforment une URL, et que Compose ne sait pas
 * encoder. Ce serait une SECONDE surface de configuration de la base, de forme
 * différente de celle de l'application, capable de diverger en silence. Ici on
 * lit exactement les mêmes variables que le serveur.
 *
 * En `.mjs` et non en TypeScript : le script doit tourner à l'identique sans
 * build préalable (poste de dev, `npm run usine`) et depuis l'image (où seul
 * `dist/` est compilé). Le prix est la relecture des variables d'environnement
 * ci-dessous, cinq lignes, plutôt qu'un import de `config/env.ts`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(here, '..', 'migrations');

// Même fichier que config/env.ts, et même sémantique : dotenv n'écrase jamais
// une variable déjà présente, donc l'environnement du conteneur l'emporte.
dotenv.config({ path: resolve(here, '..', '.env'), quiet: true });

const {
  MYSQL_HOST,
  MYSQL_PORT = '3306',
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DB,
} = process.env;

for (const [name, value] of Object.entries({ MYSQL_HOST, MYSQL_USER, MYSQL_DB })) {
  if (!value) {
    console.error(`[migrate] variable ${name} manquante`);
    process.exit(1);
  }
}

const statusOnly = process.argv.includes('--status');

/** Verrou nommé : deux runners simultanés ne doivent pas appliquer la même migration. */
const LOCK_NAME = 'secretlink_migrations';

async function connect() {
  // Attente active : en Compose le service est déclaré `service_healthy`, mais
  // en local la base peut encore accepter les connexions avec quelques
  // secondes de retard après un `up`.
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      return await mysql.createConnection({
        host: MYSQL_HOST,
        port: Number(MYSQL_PORT),
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DB,
        timezone: 'Z',
        // Les migrations contiennent plusieurs instructions par fichier. C'est
        // sans risque ICI - le SQL vient du dépôt, jamais d'une entrée
        // utilisateur - et c'est précisément pour ça que le pool applicatif,
        // lui, garde `multipleStatements: false`.
        multipleStatements: true,
      });
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error(`base injoignable après 60 s : ${lastError?.message}`);
}

async function main() {
  const cx = await connect();

  try {
    await cx.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    varchar(255) NOT NULL,
        applied_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    const [[lock]] = await cx.query('SELECT GET_LOCK(?, 30) AS ok', [LOCK_NAME]);
    if (lock.ok !== 1) {
      throw new Error('verrou de migration non obtenu : une autre exécution est en cours');
    }

    try {
      const files = readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        // Les noms commencent par un horodatage : l'ordre lexicographique EST
        // l'ordre chronologique.
        .sort();

      const [applied] = await cx.query('SELECT version FROM schema_migrations');
      const done = new Set(applied.map((r) => r.version));
      const pending = files.filter((f) => !done.has(f));

      console.log(`[migrate] ${files.length} migration(s), ${done.size} appliquée(s), ${pending.length} en attente`);

      if (statusOnly) {
        for (const f of files) console.log(`  ${done.has(f) ? '✔' : '·'} ${f}`);
        return;
      }

      for (const file of pending) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        process.stdout.write(`[migrate] ${file} … `);

        // Pas de transaction autour du DDL : MySQL committe implicitement à
        // chaque instruction DDL, une transaction ne protégerait donc rien.
        // Une migration doit être écrite pour pouvoir être rejouée.
        await cx.query(sql);
        await cx.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);

        console.log('ok');
      }

      console.log(pending.length > 0 ? '[migrate] terminé' : '[migrate] rien à faire');
    } finally {
      await cx.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
    }
  } finally {
    await cx.end();
  }
}

main().catch((err) => {
  console.error(`[migrate] échec : ${err.message}`);
  process.exit(1);
});
