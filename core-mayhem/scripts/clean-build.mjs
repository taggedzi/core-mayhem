#!/usr/bin/env node
/* eslint-env node */
// Remove compiler outputs emitted beside a TypeScript source.
// Standalone .js and authored .d.ts/.d.mts/.d.cts files are kept.
// A declaration is removed only when a real source sibling exists, never because
// the declaration file matches itself.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.husky']);
const SKIP_FILES = new Set(['eslint.config.js', 'vitest.setup.js']);

// Longer suffixes first so foo.js.map is not treated as foo.js.
const GENERATED = [
  { suffix: '.d.ts.map', sources: ['.ts', '.tsx'] },
  { suffix: '.d.mts.map', sources: ['.mts'] },
  { suffix: '.d.cts.map', sources: ['.cts'] },
  { suffix: '.js.map', sources: ['.ts', '.tsx', '.mts', '.cts'] },
  { suffix: '.d.mts', sources: ['.mts'] },
  { suffix: '.d.cts', sources: ['.cts'] },
  { suffix: '.d.ts', sources: ['.ts', '.tsx'] },
  { suffix: '.js', sources: ['.ts', '.tsx', '.mts', '.cts'] },
];

async function* walk(dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of ents) {
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      yield* walk(fullPath);
    } else if (ent.isFile()) {
      yield fullPath;
    }
  }
}

function sourceCandidates(file) {
  for (const { suffix, sources } of GENERATED) {
    if (!file.endsWith(suffix)) continue;
    const stem = file.slice(0, -suffix.length);
    return sources
      .map((ext) => stem + ext)
      .filter((candidate) => path.normalize(candidate) !== path.normalize(file));
  }
  return null;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function isGeneratedOutput(file) {
  if (SKIP_FILES.has(path.basename(file))) return false;
  const candidates = sourceCandidates(file);
  if (!candidates) return false;
  for (const candidate of candidates) {
    if (await exists(candidate)) return true;
  }
  return false;
}

/** Absolute paths of compiler outputs under root that have a real source sibling. */
export async function collectBuildOutputs(root) {
  const deletions = [];
  for await (const file of walk(root)) {
    if (await isGeneratedOutput(file)) deletions.push(file);
  }
  return deletions;
}

export async function cleanBuild({
  root = PROJECT_ROOT,
  dry = false,
  log = (...args) => globalThis.console?.log?.(...args),
  warn = (...args) => globalThis.console?.warn?.(...args),
} = {}) {
  const deletions = await collectBuildOutputs(root);
  let removed = 0;
  for (const file of deletions) {
    const rel = path.relative(root, file);
    if (dry) {
      log('[dry] rm', rel);
      continue;
    }
    try {
      await fs.unlink(file);
      removed++;
      log('rm', rel);
    } catch (err) {
      warn('skip (cannot delete):', rel, String(err?.message || err));
    }
  }
  log(dry ? `Would remove ${deletions.length} file(s).` : `Removed ${removed} file(s).`);
  return deletions;
}

function readArgs(argv) {
  const dry = argv.includes('--dry');
  const rootFlag = argv.indexOf('--root');
  if (rootFlag >= 0 && !argv[rootFlag + 1]) throw new Error('--root needs a directory');
  const root = rootFlag >= 0 ? path.resolve(argv[rootFlag + 1]) : PROJECT_ROOT;
  return { dry, root };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { dry, root } = readArgs(process.argv.slice(2));
  cleanBuild({ root, dry }).catch((err) => {
    globalThis.console?.error?.(err);
    try {
      globalThis.process?.exit?.(1);
    } catch {
      /* ignore */
    }
  });
}
