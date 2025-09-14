import { describe, it, expect, vi, beforeEach } from 'vitest';

// Heavy deps mocked
vi.mock('matter-js', () => ({
  Events: { on: vi.fn(), off: vi.fn() },
  Body: {},
  Composite: {},
}));
vi.mock('../render/draw', () => ({ drawFrame: vi.fn() }));
vi.mock('../render/hud', () => ({ updateHUD: vi.fn() }));
vi.mock('../render/score', () => ({ updateScoreboard: vi.fn() }));
vi.mock('../sim/channels', () => ({ buildLanes: vi.fn() }));
vi.mock('../sim/containers', () => ({ makeBins: vi.fn(() => ({})), nudgeBinsFromPipes: vi.fn() }));
vi.mock('../sim/core', () => ({ makeCore: vi.fn(() => ({})) }));
vi.mock('../sim/obstacles', () => ({ makePipe: vi.fn(() => ({ innerX: 0 })), placeObstaclesFromSpecs: vi.fn() }));
vi.mock('../sim/pins', () => ({ makePins: vi.fn(() => ({ mid: 0, width: 0 })) }));
vi.mock('../sim/weapons', () => ({ makeWeapons: vi.fn(() => ({ cannon: { pos: { x: 0, y: 0 }, mount: {} }, laser: { pos: { x: 0, y: 0 }, mount: {} }, missile: { pos: { x: 0, y: 0 }, mount: {} }, mortar: { pos: { x: 0, y: 0 }, mount: {} } })) }));
vi.mock('../sim/world', () => ({
  initWorld: vi.fn((canvas: HTMLCanvasElement) => {
    // Seed minimal world/engine and canvas metrics
    (sim as any).engine = {};
    (sim as any).world = {};
    (sim as any).W = (canvas.width ||= 800);
    (sim as any).H = (canvas.height ||= 600);
  }),
  clearWorld: vi.fn(() => {
    (sim as any).engine = null;
    (sim as any).world = null;
  }),
}));
vi.mock('./collisions', () => ({ registerCollisions: vi.fn(() => vi.fn()) }));
vi.mock('./devKeys', () => ({ attachDevHotkeys: vi.fn(() => vi.fn()) }));
vi.mock('./stats', () => ({ startNewMatch: vi.fn() }));
vi.mock('./systems/announcer', () => ({ runAnnouncer: vi.fn() }));
vi.mock('./systems/audioMonitors', () => ({ runAudioMonitors: vi.fn() }));
vi.mock('./systems/fx', () => ({ runFXPrune: vi.fn() }));
vi.mock('./systems/match', () => ({ checkTimeLimit: vi.fn(), maybeEndMatch: vi.fn() }));
vi.mock('./systems/physics', () => ({ runPhysics: vi.fn() }));
vi.mock('./systems/spawn', () => ({ runSpawn: vi.fn() }));
vi.mock('./systems/triggers', () => ({ runTriggers: vi.fn() }));
vi.mock('../banter', () => ({
  BanterSystem: class { constructor(_o: any) {} step() {} },
  createCharacter: vi.fn((side: 'left'|'right', p: any, name: string) => ({ side, p, name })),
}));
vi.mock('../ui/banterControls', () => ({ readBanterPacing: vi.fn(() => ({ cooldownMs: 5000, sideMinGapMs: 12000 })) }));
vi.mock('../ui/characters', () => ({ readCharacterProfiles: vi.fn(() => ({ left: { name: 'LeftCore' }, right: { name: 'RightCore' }, leftName: 'Left', rightName: 'Right' })) }));
vi.mock('../audio', () => ({
  audio: {
    preloadAll: vi.fn(),
    hasPlaylist: vi.fn(() => false),
    isMusicPlaying: vi.fn(() => false),
    setMusicPlaylist: vi.fn(),
    playMusic: vi.fn(),
    stopLoop: vi.fn(),
    setAnnouncerVolume: vi.fn(),
    duck: vi.fn(), duckSfx: vi.fn(), playUrl: vi.fn(), stopAnnouncer: vi.fn(),
  },
}));

import { startGame } from '../app/game';
import { sim } from '../state';

describe('app/game start/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mock timers & raf
    (globalThis as any).requestAnimationFrame = vi.fn(() => 1);
    (globalThis as any).cancelAnimationFrame = vi.fn();
    (globalThis as any).setInterval = vi.fn(() => 99);
    (globalThis as any).clearInterval = vi.fn();
  });

  it('initializes world, seeds sim, sets up systems, and stops cleanly', () => {
    const canvas = document.createElement('canvas');
    const ctx2d: any = { fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), stroke: vi.fn(), fill: vi.fn() };
    (canvas as any).getContext = vi.fn(() => ctx2d);

    const stop = startGame(canvas);
    // started
    expect((sim as any).started).toBe(true);
    // world / engine seeded
    expect((sim as any).engine).toBeTruthy();
    // banter system created
    expect((sim as any).banter).toBeTruthy();
    // weapons created
    expect((sim as any).wepL).toBeTruthy();
    expect((sim as any).wepR).toBeTruthy();

    // Calling stop cleans up
    stop();
    expect((sim as any).started).toBe(false);
    // cancelAnimationFrame called
    expect((globalThis.cancelAnimationFrame as any).mock.calls.length).toBeGreaterThan(0);
  });
});
