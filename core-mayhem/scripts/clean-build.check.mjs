import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { cleanBuild } from './clean-build.mjs';

const script = fileURLToPath(new URL('./clean-build.mjs', import.meta.url));

const OUTPUTS = [
  'src/widget.js',
  'src/widget.js.map',
  'src/widget.d.ts',
  'src/widget.d.ts.map',
  'src/panel.js',
  'src/panel.d.ts',
  'src/button.group.d.ts',
  'src/mod.js',
  'src/mod.d.mts',
  'src/legacy.js.map',
  'src/legacy.d.cts',
];

const KEPT = [
  'src/widget.ts',
  'src/panel.tsx',
  'src/button.group.ts',
  'src/mod.mts',
  'src/legacy.cts',
  'ambient/types.d.ts',
  'ambient/extra.d.mts',
  'ambient/notes.js',
  'ambient/notes.js.map',
  'eslint.config.js',
  'vitest.setup.js',
  'vitest.setup.ts',
  'node_modules/pkg/index.js',
  'node_modules/pkg/index.ts',
];

async function writeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'clean-build-'));
  const files = [...OUTPUTS, ...KEPT];
  for (const rel of files) {
    const full = path.join(root, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, rel);
  }
  return root;
}

async function present(root, rel) {
  try {
    await access(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
}

function listedRemovals(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('[dry] rm '))
    .map((line) => line.slice('[dry] rm '.length).split(/[/\\]/).join('/'))
    .sort();
}

test('dry-run lists only compiler outputs and leaves authored declarations', async () => {
  const root = await writeFixture();
  try {
    const lines = [];
    const found = await cleanBuild({
      root,
      dry: true,
      log: (...args) => lines.push(args.join(' ')),
    });
    assert.equal(found.length, OUTPUTS.length);
    assert.equal(lines.at(-1), `Would remove ${OUTPUTS.length} file(s).`);
    assert.deepEqual(listedRemovals(lines.join('\n')), [...OUTPUTS].sort());
    for (const rel of [...OUTPUTS, ...KEPT]) assert.equal(await present(root, rel), true);

    const printed = spawnSync(process.execPath, [script, '--dry', '--root', root], {
      encoding: 'utf8',
    });
    assert.equal(printed.status, 0, printed.stderr);
    assert.deepEqual(listedRemovals(printed.stdout), [...OUTPUTS].sort());
    assert.match(printed.stdout, new RegExp(`Would remove ${OUTPUTS.length} file\\(s\\)\\.`));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('clean removes generated outputs and keeps standalone declarations', async () => {
  const root = await writeFixture();
  try {
    await cleanBuild({
      root,
      log() {
        return undefined;
      },
      warn() {
        return undefined;
      },
    });
    for (const rel of OUTPUTS) assert.equal(await present(root, rel), false, rel);
    for (const rel of KEPT) assert.equal(await present(root, rel), true, rel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
