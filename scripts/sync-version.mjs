#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const check = process.argv.includes('--check');

const files = [
  'client/package.json',
  'client/package-lock.json',
  'server/package.json',
  'server/package-lock.json',
];

let drift = 0;

for (const file of files) {
  const path = resolve(root, file);
  const json = JSON.parse(readFileSync(path, 'utf-8'));
  if (json.version === version) continue;

  drift++;
  if (check) {
    console.error(`[drift]  ${file}  ${json.version} ≠ ${version}`);
    continue;
  }

  console.log(`[synced] ${file}  ${json.version} → ${version}`);
  json.version = version;
  if (json.packages?.['']) json.packages[''].version = version; // lockfile : 2e emplacement
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

if (!drift) console.log(`Tout est à ${version}`);
if (check && drift) process.exit(1);
