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
