import { copyFileSync, mkdirSync } from 'node:fs';

const destination = new URL('../public/licenses/', import.meta.url);
mkdirSync(destination, { recursive: true });
for (const [source, name] of [
  ['LICENSE', 'LICENSE.txt'],
  ['MEDIA_LICENSES.md', 'MEDIA_LICENSES.txt'],
  ['THIRD_PARTY_NOTICES.txt', 'THIRD_PARTY_NOTICES.txt'],
]) {
  copyFileSync(new URL(`../../${source}`, import.meta.url), new URL(name, destination));
}
