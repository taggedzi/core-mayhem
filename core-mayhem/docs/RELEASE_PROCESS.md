# Build and deploy

## Download the site

Open the repository's **Releases** page and download the attached
`core-mayhem-YYYY.MM.DD.N.zip`. Extract the ZIP, rather than GitHub's automatic
"Source code" archives. Public release downloads do not require GitHub sign-in
and do not expire like Actions artifacts.

The site includes game bundles, sound effects, announcer clips, and license
notices, but no background music. No rebuild is required before deploying it.

## Publish a release: one command

Once per machine, install GitHub CLI (`gh`) and sign in with `gh auth login`.
Use an account with write access to this repository and permission to run
workflows. You also need Node.js 24 locally; the build itself runs on GitHub.

After committing and pushing your changes, run this in the inner
`core-mayhem/` application directory:

```bash
npm run release
```

The command checks your checkout, starts the GitHub Release workflow, waits
for it, and prints the release page and direct ZIP download links. The build
runs types, lint, formatting, versioning tests, coverage tests, and the portable
build before publishing. No manual version edit, tag, or npm publish is needed.

Versions use **America/New_York** dates: `2026.10.23.1`, `2026.10.23.2`, then
`2026.10.24.1`. The counter follows the highest existing tag for that date.
`package.json` keeps its internal version; the release tag, ZIP filename, and
the ZIP's `version.json` identify the distributed version and source commit.

The script refuses releases from a different branch, with uncommitted or
unpushed changes, or while another release is running. The tracked generated
`tsconfig.tsbuildinfo` cache is ignored by this check. Releases use an exact
commit, never overwrite an existing tag, and fail if there are no new commits
since the last public release. An interrupted command does not cancel GitHub's
run: check its printed link before trying again.

To verify the process without publishing:

```bash
npm run release -- --dry-run
```

A dry run creates neither a tag nor a public release. Its ZIP is available as
the `release-site` Actions artifact for seven days. You can also open
**Actions → Release → Run workflow** on `main`; select **dry_run** to test.
Leave the other inputs blank when using the GitHub UI.

If a run fails, open its link to see the failed step, fix the issue, commit and
push if needed, and run the command again. If a draft release remains after a
failed upload, it is not public; the next attempt uses a new version rather
than overwriting it. Repository tag rules must permit the workflow's GitHub
token to create `v*` tags; publishing fails clearly if those rules block it.

## Add deployment music

Copy MP3 or OGG tracks into the extracted `assets/music/` folder. Replace
`assets/music/playlist.json` with filenames relative to that folder:

```json
["opening.mp3", "battle.ogg"]
```

Match filename capitalization and use music you have permission to host.
Leave the playlist as `[]` to play without music. Sound effects and the
announcer still work.

Upload the complete extracted folder contents to your static host, preserving
`licenses/` and the directory structure. Serve over HTTP or HTTPS, rather than
opening a local HTML file. Subdirectory hosting is supported; use a trailing
slash, such as `/games/core-mayhem/`. Start a match to check playback.

When updating music, use new filenames or clear the host's cache. The included
`_headers` file applies only on hosts that support it; configure equivalent
headers separately on other hosts.

## Build locally

Run these commands inside the inner `core-mayhem/` directory with Node.js 24:

```bash
npm ci
npm run check
npm run test:coverage
npm run build:portable
npm run preview
```

`build:portable` removes music from build output only and writes an empty
playlist. Your original local music is preserved. Add your deployment tracks
to `dist/assets/music/` after building, then upload the contents of `dist/`.
Every build replaces `dist/`; keep your source tracks elsewhere.

For your personal build, keep tracks and a playlist in the Git-ignored
`public/assets/music/` directory and run `npm run build`. That command continues
to include local music automatically.

## Workflows

CI runs formatting, type checks, lint, versioning tests, coverage tests, and a
production build on pull requests, pushes to `main`, and manual runs. Portable
site packages a temporary music-free Actions artifact on `v*` tags or manual
runs. Release builds and publishes the permanent ZIP when requested. None of
these workflows deploys to a website or needs hosting credentials.

Workflow files are in the repository root's `.github/workflows/`; npm commands
run in the inner application directory. Generated sound effects and announcer
clips are tracked, so builds need neither music downloads nor eSpeak NG.

Formatting, types, lint, tests, coverage thresholds, and builds are required.
