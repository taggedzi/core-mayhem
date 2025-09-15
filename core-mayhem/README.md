# Core Mayhem

Lightweight 2D canvas arena powered by Matter.js with a fixed logical canvas (1920x1080) and scale-to-fit rendering.

## Quick Start

- Install deps: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

## Deployment

- Build artifacts: `core-mayhem/dist` (configured in `core-mayhem/vite.config.ts`).
- Build for production: from `core-mayhem/` run `npm run build`.
- Preview the built site locally: from `core-mayhem/` run `npm run preview`.
- What to deploy: upload or point your host to the `core-mayhem/dist` folder. It contains only static files (HTML/CSS/JS/assets) and can be served by any static host (S3/CloudFront, Cloudflare Pages, Netlify, Vercel, Nginx/Apache, etc.).
- Paths: the config sets `base: './'` so built asset URLs are relative; you can host the folder at domain root or under a subpath without extra changes.

### Common Hosts
- Netlify / Vercel / Cloudflare Pages: set the project root to `core-mayhem`, the build command to `npm run build`, and the publish directory to `core-mayhem/dist` (or just `dist` if the platform treats `core-mayhem` as the working dir).
- Any VPS / Nginx / Apache: copy `core-mayhem/dist` to your web root (e.g., `/var/www/site`), configure the server to serve static files from that directory.
- GitHub Pages: either
  - Use a GitHub Action that builds in `core-mayhem` and publishes `core-mayhem/dist` to the `gh-pages` branch; or
  - Reconfigure `outDir` to `../docs` (and push `docs/` to main) if you prefer the Pages “Docs” source. With the current `base: './'`, both approaches work.

### Assets
- Files placed in `core-mayhem/public` are copied to `dist` unchanged and served at the same path (e.g., `public/assets/music/*` → `/assets/music/*`).
- Other assets referenced from code are bundled and hashed by Vite.

## Quality

- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (auto-fix: `npm run lint:fix`)
- Format check: `npm run format` (write: `npm run format:write`)
- Tests: `npm test` (coverage: `npm run test:coverage`)

## Maintenance

- Prune unused exports (static analysis):
  - Run: `npm run prune`
  - Notes:
    - This uses ts-prune with the Vitest config ignored.
    - If a file is used by tooling (not via TS imports), consider extending the ignore pattern.

## Notes

- The game logic runs in fixed logical units; the canvas scales on resize without restarting matches.

## Audio System

- Config lives in `core-mayhem/src/audio/config.ts` and maps in-game events to files and defaults (volume, rate, loop, limits).
- Event keys are in `core-mayhem/src/audio/keys.ts`.
- Runtime API is a safe singleton exported from `core-mayhem/src/audio/index.ts`.
  - `audio.preloadAll()` is called on game start.
  - `audio.play('event_key')` triggers overlapping SFX with cooldown + concurrency caps.
  - `audio.startLoop(id, 'core_low_hp_alarm')` and `audio.stopLoop(id)` manage looped sounds.
  - `audio.setSfxVolume(v)` / `audio.setMusicVolume(v)` adjust channel volumes.
  - Music ducking is automatic for certain SFX via `duckMusic` in the config.
- Low-HP alarms are monitored in `core-mayhem/src/app/systems/audioMonitors.ts` and toggle per-side loops.

### Background Music
- Place tracks under `core-mayhem/public/assets/music/` (mp3 or ogg). These are served statically and not bundled into JS.
- Create `core-mayhem/public/assets/music/playlist.json` with an array of filenames, for example:
  - `["main_theme.mp3", "battle_loop.ogg", "ambient.ogg"]`
- On startup, the game loads the playlist and streams via an HTMLAudioElement → WebAudio graph (so ducking still works). When a track ends, it advances to the next and loops the list.
- Fallback: if `playlist.json` is missing, it probes `/assets/music/main_theme.mp3`.
- Control music volume via `audio.setMusicVolume(v)` and SFX ducking works as before.

To change which sound plays for an event or tweak volumes/pitch, edit `core-mayhem/src/audio/config.ts` (no code changes required).

## Sounds and Music Licenses

- **Pixel Combat Sound Pack** by Helton Yan  
  Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)  
  Source: [Itch.io](https://heltonyan.itch.io/pixelcombat)

- **Announcer Voice Pack** by John Carroll  
  Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)  
  Source: [Itch.io](https://johncarroll.itch.io/announcer-voice-pack)

- **Sirens and Alarm Noise** by Robinhood76  
  Licensed under [CC0 1.0 Public Domain](https://creativecommons.org/publicdomain/zero/1.0/)  
  Source: [OpenGameArt](https://opengameart.org/content/sirens-and-alarm-noise)

See [licenses.txt](licenses.txt) for detailed license information.
