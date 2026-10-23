import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../../', import.meta.url));
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
const gh = (...args) => run('gh', args);
const git = (...args) => run('git', args);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--dry-run') || args.length > 1) {
    throw new Error('Use npm run release or npm run release -- --dry-run.');
  }
  const dryRun = args.includes('--dry-run') || process.env.npm_config_dry_run === 'true';
  gh('auth', 'status');
  if (git('branch', '--show-current') !== 'main')
    throw new Error('Switch to main before releasing.');
  // TypeScript rewrites this tracked cache during builds; it is never release source.
  const changes = git(
    'status',
    '--porcelain',
    '--untracked-files=normal',
    '--',
    '.',
    ':(exclude)core-mayhem/tsconfig.tsbuildinfo',
  );
  if (changes) throw new Error('Commit and push your changes first.\n' + changes);
  const repository = JSON.parse(gh('repo', 'view', '--json', 'nameWithOwner')).nameWithOwner;
  const sha = git('rev-parse', 'HEAD');
  const remoteSha = gh('api', `repos/${repository}/commits/main`, '--jq', '.sha');
  if (sha !== remoteSha)
    throw new Error('Local main differs from GitHub main. Sync your commits first.');
  const active = JSON.parse(
    gh(
      'run',
      'list',
      '--repo',
      repository,
      '--workflow',
      'release.yml',
      '--limit',
      '100',
      '--json',
      'status',
    ),
  );
  if (active.some((item) => item.status !== 'completed')) {
    throw new Error('A release is already running. Wait for it to finish before trying again.');
  }
  const request = randomUUID();
  gh(
    'workflow',
    'run',
    'release.yml',
    '--repo',
    repository,
    '--ref',
    'main',
    '-f',
    `expected_sha=${sha}`,
    '-f',
    `request_id=${request}`,
    '-f',
    `dry_run=${dryRun}`,
  );
  console.log(
    dryRun ? 'Checking a release without publishing...' : 'Building and publishing a release...',
  );
  let workflow;
  for (let attempt = 0; attempt < 30; attempt++) {
    const runs = JSON.parse(
      gh(
        'run',
        'list',
        '--repo',
        repository,
        '--workflow',
        'release.yml',
        '--limit',
        '100',
        '--json',
        'databaseId,displayTitle,url',
      ),
    );
    workflow = runs.find((item) => item.displayTitle === `Release ${request}`);
    if (workflow) break;
    await pause(2000);
  }
  if (!workflow)
    throw new Error(
      `Release was requested, but its run is not visible yet. Check https://github.com/${repository}/actions/workflows/release.yml before retrying.`,
    );
  console.log(workflow.url);
  // Poll a specific request, so concurrent pushes cannot point us at the wrong run.
  const deadline = Date.now() + 30 * 60 * 1000;
  while (true) {
    const state = JSON.parse(
      gh(
        'run',
        'view',
        String(workflow.databaseId),
        '--repo',
        repository,
        '--json',
        'status,conclusion',
      ),
    );
    if (state.status === 'completed') {
      if (state.conclusion !== 'success')
        throw new Error(`Release ${state.conclusion}. See ${workflow.url}`);
      break;
    }
    if (Date.now() > deadline)
      throw new Error(`Still waiting. Check ${workflow.url} before retrying.`);
    await pause(10000);
  }
  if (dryRun) {
    console.log(`Dry run passed. No tag or public release created. Test ZIP: ${workflow.url}`);
  } else {
    const releases = JSON.parse(
      gh('api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`),
    ).flat();
    const release = releases.find((item) => item.body?.includes(`Release request: ${request}`));
    if (!release) throw new Error(`Build passed. Find the release link in ${workflow.url}`);
    console.log(`Released ${release.tag_name}: ${release.html_url}`);
    for (const asset of release.assets) console.log(`Download: ${asset.browser_download_url}`);
  }
} catch (error) {
  console.error(error.stderr?.toString().trim() || error.message);
  process.exitCode = 1;
}
