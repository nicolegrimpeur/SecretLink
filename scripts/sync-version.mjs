#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const version = rootPkg.version;

const targets = [
  resolve(root, 'client', 'package.json'),
  resolve(root, 'server', 'package.json'),
];

for (const target of targets) {
  const pkg = JSON.parse(readFileSync(target, 'utf-8'));
  if (pkg.version === version) {
    console.log(`[skip]   ${target.replace(root, '.')} already at ${version}`);
    continue;
  }
  const previous = pkg.version;
  pkg.version = version;
  writeFileSync(target, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`[synced] ${target.replace(root, '.')}  ${previous} → ${version}`);
}
