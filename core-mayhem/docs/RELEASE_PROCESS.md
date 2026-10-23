# Build and deploy

## Download the site

Open GitHub **Actions → Portable site → Run workflow**. Pushing a version tag
such as `v0.0.1` also starts a build. Download `core-mayhem-site` from the
successful run's **Artifacts** section and extract the ZIP. Downloads require
GitHub sign-in and expire after 30 days; rerun the workflow for a fresh copy.

The site includes game bundles, sound effects, announcer clips, and license
notices, but no background music. No rebuild is required before deploying it.

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

CI runs formatting, type checks, lint, coverage tests, and a production build
on pull requests, pushes to `main`, and manual runs. Portable site runs the
same checks and packages a music-free build on `v*` tags or manual runs.
Neither workflow deploys or needs hosting credentials.

Workflow files are in the repository root's `.github/workflows/`; npm commands
run in the inner application directory. Generated sound effects and announcer
clips are tracked, so builds need neither music downloads nor eSpeak NG.

Formatting is currently advisory in GitHub because the repository has existing
formatting debt. Types, lint, tests, coverage thresholds, and builds are required.
