import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function nextVersion(tags, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  const date = `${value('year')}.${value('month')}.${value('day')}`;
  let sequence = 0;
  for (const tag of tags) {
    const match = /^v(\d{4}\.\d{2}\.\d{2})\.([1-9]\d*)$/.exec(tag);
    if (match?.[1] === date) sequence = Math.max(sequence, Number(match[2]));
  }
  return `${date}.${sequence + 1}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tags = execFileSync(
    'gh',
    [
      'api',
      '--paginate',
      `repos/${process.env.GITHUB_REPOSITORY}/git/matching-refs/tags/`,
      '--jq',
      '.[].ref',
    ],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\r?\n/)
    .map((ref) => ref.replace(/^refs\/tags\//, ''));
  const version = nextVersion(tags);
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`);
}
