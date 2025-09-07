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
