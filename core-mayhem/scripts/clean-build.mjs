#!/usr/bin/env node
// Remove JS artifacts emitted by TypeScript next to .ts files, plus their maps.
// Safe by default: only deletes .js/.js.map (and .d.ts) when a sibling .ts/tsx exists.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve project root robustly across platforms (Windows included)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..'); // core-mayhem

const DRY = process.argv.includes('--dry');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.husky',
]);

const TS_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts']);

/** Recursively walk directories starting from base, skipping SKIP_DIRS */
async function* walk(dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of ents) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      yield* walk(p);
    } else if (ent.isFile()) {
      yield p;
    }
  }
}

function hasTsSiblingCandidates(file) {
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  // If file is foo.js or foo.js.map or foo.d.ts, check foo.ts/tsx/mts/cts existence
  const variants = [
    base,
    base.replace(/\.js$/, ''), // when checking foo.js.map -> base=foo.js -> strip .js
  ];
  return variants;
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  let removed = 0;
  let scanned = 0;
  const deletions = [];

  for await (const file of walk(PROJECT_ROOT)) {
    scanned++;
    const ext = path.extname(file);
    const name = path.basename(file);

    // Only consider .js, .js.map, and .d.ts
    if (ext !== '.js' && !(name.endsWith('.js.map')) && !(name.endsWith('.d.ts'))) continue;

    // Skip known source JS files that are not TS outputs
    if (name === 'eslint.config.js' || name === 'vitest.setup.js') continue;

    const bases = hasTsSiblingCandidates(file);
    let tsNeighbor = false;
    for (const b of bases) {
      for (const te of TS_EXTS) {
        if (await exists(b + te)) { tsNeighbor = true; break; }
      }
      if (tsNeighbor) break;
    }
    if (!tsNeighbor) continue; // do not delete JS without TS neighbor

    deletions.push(file);
  }

  // Delete gathered files
  for (const f of deletions) {
    if (DRY) {
      console.log('[dry] rm', path.relative(PROJECT_ROOT, f));
      continue;
    }
    try {
      await fs.unlink(f);
      removed++;
      console.log('rm', path.relative(PROJECT_ROOT, f));
    } catch (err) {
      console.warn('skip (cannot delete):', path.relative(PROJECT_ROOT, f), String(err?.message || err));
    }
  }

  const msg = DRY ? `Would remove ${deletions.length} file(s).` : `Removed ${removed} file(s).`;
  console.log(msg);
}

main().catch((err) => { console.error(err); process.exit(1); });
