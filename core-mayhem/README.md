# Core Mayhem

Lightweight 2D canvas arena powered by Matter.js with a fixed logical canvas (1920x1080) and scale-to-fit rendering.

## Quick Start

- Install deps: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

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
