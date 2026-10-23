import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextVersion } from './release-version.mjs';

test('first release uses New York date, including around UTC midnight', () => {
  assert.equal(nextVersion([], new Date('2026-10-24T02:00:00Z')), '2026.10.23.1');
});

test('increments the highest same-day tag and ignores other formats and dates', () => {
  assert.equal(
    nextVersion(
      ['v2026.10.23.2', 'v2026.10.23.10', 'v2026.10.22.99', 'v0.1.0', 'v2026.10.23.12-beta'],
      new Date('2026-10-23T18:00:00Z'),
    ),
    '2026.10.23.11',
  );
});

test('resets numbering at New York midnight, including daylight saving time', () => {
  assert.equal(nextVersion(['v2026.10.23.10'], new Date('2026-10-24T04:00:00Z')), '2026.10.24.1');
  assert.equal(nextVersion([], new Date('2026-01-01T04:59:59Z')), '2025.12.31.1');
  assert.equal(nextVersion([], new Date('2026-01-01T05:00:00Z')), '2026.01.01.1');
});
