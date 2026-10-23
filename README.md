# Core Mayhem

**An idle combat game where pachinko physics fuel a race to destroy the opposing core.**

[![CI: tests and build](https://github.com/taggedzi/core-mayhem/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/taggedzi/core-mayhem/actions/workflows/ci.yml)
[![Release](https://github.com/taggedzi/core-mayhem/actions/workflows/release.yml/badge.svg)](https://github.com/taggedzi/core-mayhem/actions/workflows/release.yml)

[![Play Core Mayhem](https://img.shields.io/badge/Play-Core%20Mayhem-e85d35?style=for-the-badge)](https://core-mayhem.taggedz.me/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)](core-mayhem/package.json)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white)](core-mayhem/vite.config.ts)
[![Matter.js](https://img.shields.io/badge/Physics-Matter.js-4B5563)](core-mayhem/package.json)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)](core-mayhem/vitest.config.ts)

Two cores face off in a physics-driven arena. Resources bounce through pins, obstacles, and channels into collection bins, powering weapons, repairs, and combat effects. Cannons fire, lasers cut through defenses, and homing missiles hunt their targets. Start the simulation, follow the momentum, and watch one core bring the other down.

[Play in your browser](https://core-mayhem.taggedz.me/) · [Run locally](#run-locally) · [Development](#development) · [Deployment](#deployment)

## Features

- **Hands-off combat:** resource collection and weapon firing run automatically.
- **Pachinko-style physics:** bouncing resources and moving obstacles shape the flow of battle.
- **Multiple weapons:** cannons, lasers, homing missiles, and mortars attack opposing cores.
- **Layered survival:** armor, shields, repairs, buffs, and debuffs affect each round.
- **Match series:** rounds build toward a series winner, with automatic restarts, random character matchups, and round-robin tournament mode.
- **Character personality:** configurable personas and event-driven banter bring the rivalry to life.
- **Audio and statistics:** sound effects, a synthesized announcer, music controls, and battle statistics support the action.

The game renders on a 1920 × 1080 logical canvas that scales to fit the available space.

## How to play

1. Open [Core Mayhem](https://core-mayhem.taggedz.me/) in a modern browser with JavaScript enabled, then select **Start** on the welcome screen.
2. Watch resources feed the two cores' combat systems. Destroying the opposing core wins a round; round wins decide the series.

Normal play requires no aiming or manual weapon control. Use the header controls while watching:

When a match ends, gameplay freezes during the result banner. Health, collected
resources, and final statistics stay fixed; low-health alarms stop. A time-limit
tie also shows **Game Over** in the HUD.

Stopping or ending a match cancels pending weapon windups and burst shots. Starting
a new match never resumes a previous match's unfinished volleys.

| Control           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| **Start / Stop**  | Start or stop the simulation.                        |
| **Stats**         | Inspect battle statistics.                           |
| **Audio**         | Adjust sound and music settings.                     |
| **Banter**        | Configure dialogue and optional generated responses. |
| **Characters**    | Choose character settings and matchup mode.          |
| **Help** or **H** | Open the developer hotkey reference.                 |

Developer hotkeys are enabled in development builds and disabled in production by default.

### Optional generated banter

Built-in banter works without an AI service. For generated dialogue, the **Banter** panel supports an optional Ollama connection with a configurable server URL and model. LLM requests are disabled by default; the default server address is `http://localhost:11434`.

Ollama must be running with an available model, and the browser must be allowed to reach it. Neither Ollama nor a model download is required to play or build the game.

## Run locally

**Requirements:** Git, npm, and Node.js **22.12 or newer in the 22.x line, or Node.js 24+**, compatible with the installed Vite and Vitest dependencies.

```bash
git clone https://github.com/taggedzi/core-mayhem.git
cd core-mayhem/core-mayhem
npm ci
npm run dev
```

Open the local URL printed by Vite. Run npm commands from the **inner `core-mayhem/` directory**, which contains `package.json`.

## Development

The game is written in TypeScript, rendered with the browser's 2D canvas, and simulated with Matter.js. Vite handles development and production bundling; Vitest runs the test suite.

### Commands

Run these inside the application directory:

| Command                 | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `npm run dev`           | Start the development server.                                         |
| `npm run build`         | Compile TypeScript and build the production site in `dist/`.          |
| `npm run preview`       | Serve an existing production build locally.                           |
| `npm run typecheck`     | Check TypeScript without emitting files.                              |
| `npm run lint`          | Run ESLint; use `npm run lint:fix` to apply fixes.                    |
| `npm run format`        | Check formatting; use `npm run format:write` to apply it.             |
| `npm test`              | Run the test suite once.                                              |
| `npm run test:watch`    | Run tests in watch mode.                                              |
| `npm run test:coverage` | Run tests with coverage reporting.                                    |
| `npm run check`         | Run type checking, linting, and formatting checks.                    |
| `npm run ci`            | Run type checking, linting, coverage tests, and the production build. |
| `npm run sim`           | Run batch simulations and write reports to `stats/`.                  |

`npm run ci` does not include formatting; run `npm run format` separately when validating a contribution. Batch simulations also run as part of the full test suite and can generate timestamped reports.

### Project layout

```text
core-mayhem/                 # Repository root
├── README.md
└── core-mayhem/             # Application root; run npm commands here
    ├── index.html          # Page shell and header controls
    ├── styles.css          # Game and overlay styles
    ├── public/             # Static files copied into the build
    ├── src/
    │   ├── main.ts         # Application entry point
    │   ├── boot.ts         # Game bootstrapping
    │   ├── app/            # Lifecycle, game systems, and statistics
    │   ├── sim/            # Physics, resources, weapons, and damage
    │   ├── core/           # Core repair logic
    │   ├── render/         # Canvas rendering and HUD
    │   ├── configs/        # Gameplay, world, weapon, and visual tuning
    │   ├── config/         # LLM configuration
    │   ├── ui/             # Settings panels and overlays
    │   ├── audio/          # Audio playback and event configuration
    │   ├── announcer/      # Announcer behavior
    │   ├── banter/         # Personas, dialogue, and Ollama integration
    │   ├── tools/          # Batch simulation harness
    │   └── __tests__/      # Unit, flow, rendering, and simulation tests
    ├── docs/               # Release documentation
    ├── scripts/            # Development utilities
    └── batch.config.json   # Batch simulation settings
```

### Configuration and debugging

- Edit `src/configs/` for gameplay defaults, arena layout, core behavior, weapons, and effects. `src/config.ts` re-exports these modules.
- Edit `src/audio/config.ts` to map audio events to files and adjust playback defaults.
- Edit `src/config/llm.ts` for default banter-provider settings.
- Edit `batch.config.json`, then run `npm run sim` to compare simulation outcomes. Reports are written under the application's `stats/` directory.

During development, press **H** to see the available hotkeys. For example, `c / l / m / o` fire the left core's cannon, laser, missiles, or mortar; uppercase versions fire the right core's weapons. `[` and `]` adjust simulation speed.

### Contributing and reporting issues

See the [contribution guide](CONTRIBUTING.md) for setup, validation, and pull request
instructions. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) when participating
in the project.

Keep changes focused and describe the behavior being changed. Add or update tests when changing simulation behavior, then run `npm run ci` and `npm run format` before submitting a pull request.

For bug reports, include the browser, reproduction steps, expected behavior, and console errors. For simulation or balance issues, include the relevant configuration and seed when available.

## Deployment

From the application directory:

```bash
npm run build
npm run preview
```

Check the production preview, then deploy the contents of `core-mayhem/dist/` relative to the repository root. The build is a static site and requires no application server for normal gameplay.

| Hosting setting                                     | Value           |
| --------------------------------------------------- | --------------- |
| Project / working directory                         | `core-mayhem`   |
| Install command                                     | `npm ci`        |
| Build command                                       | `npm run build` |
| Output directory, relative to the working directory | `dist`          |

Vite uses `base: './'` for relative built asset URLs. Check audio and other runtime-loaded assets when hosting under a subpath. Files in `public/` are copied unchanged; `public/_headers` supplies headers for hosts that support that format.

See the [release guide](core-mayhem/docs/RELEASE_PROCESS.md) for additional deployment details. The command table above reflects the current package scripts.

## Credits and licensing

Original project code and documentation are licensed under [MIT](LICENSE).
Music by Matthew Craig is separately copyrighted, with all rights reserved.
All active combat effects and the alarm are original procedural synthesis
covered by MIT. Regenerate combat effects with `npm run audio:generate` from
the application directory.
See [media licenses and exclusions](MEDIA_LICENSES.md) for file mappings,
modification notices, sources, and redistribution requirements, and
[third-party software notices](THIRD_PARTY_NOTICES.txt) for Matter.js.

The announcer uses 49 bundled robotic voice clips synthesized offline with
eSpeak NG. These original recordings and their generation scripts use MIT.
Run `npm run audio:announcer` to regenerate them with eSpeak NG installed.
Players do not need eSpeak NG or an online speech service.

The in-game Credits link opens the media notice; code and dependency license
texts ship alongside it in `licenses/`. Asset folders are excluded by the
root `.gitignore`; the original generated effects are tracked separately
under `src/audio/`. No Helton Yan recordings remain in the active game or
production build. The music is not licensed for redistribution by downstream users.

### Download and customize a built site

Download the music-free site ZIP from [Releases](https://github.com/taggedzi/core-mayhem/releases),
extract it, add your own tracks and `assets/music/playlist.json`, then upload
the site to your host. No rebuild is needed.

To publish a release, commit and push your changes, then run `npm run release`
inside the inner `core-mayhem/` directory. GitHub runs checks, builds the site,
assigns a New York date-based version such as `2026.10.23.1`, and publishes the
ZIP. The command waits and prints the download link. GitHub CLI must be signed
in; see the [release and deployment guide](core-mayhem/docs/RELEASE_PROCESS.md).

Use `npm run build:portable` for the same music-free output locally. Ordinary
`npm run build` still includes your ignored local music for personal deployments.
