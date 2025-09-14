import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('matter-js', () => {
  const setPosition = vi.fn();
  const allBodies = vi.fn(() => []);
  return {
    Events: { on: vi.fn(), off: vi.fn(), trigger: (_: any, __: any, ___: any) => {} },
    Body: { setPosition },
    Composite: { allBodies },
  } as any;
});
vi.mock('../render/draw', () => ({ drawFrame: vi.fn() }));
vi.mock('../render/hud', () => ({ updateHUD: vi.fn() }));
vi.mock('../render/score', () => ({ updateScoreboard: vi.fn() }));
vi.mock('../sim/channels', () => ({ buildLanes: vi.fn() }));

// Return bins with positions to be mirrored
vi.mock('../sim/containers', () => ({
  makeBins: vi.fn(() => ({
    A: {
      pos: { x: 30, y: 0 },
      box: { position: { x: 30, y: 7 } },
      intake: { position: { x: 40, y: 9 } },
    },
  })),
  nudgeBinsFromPipes: vi.fn(),
}));

vi.mock('../sim/core', () => ({ makeCore: vi.fn(() => ({ center: { x: 10, y: 0 } })) }));
vi.mock('../sim/obstacles', () => ({ makePipe: vi.fn(() => ({ innerX: 0 })), placeObstaclesFromSpecs: vi.fn() }));
vi.mock('../sim/pins', () => ({ makePins: vi.fn(() => ({ mid: 0, width: 0 })) }));
// Weapons with mount positions to mirror
vi.mock('../sim/weapons', () => ({ makeWeapons: vi.fn(() => ({
  cannon: { pos: { x: 5, y: 0 } },
  laser: { pos: { x: 15, y: 0 } },
  missile: { pos: { x: 25, y: 0 } },
  mortar: { pos: { x: 35, y: 0 } },
})) }));
vi.mock('../sim/world', () => ({
  initWorld: vi.fn((canvas: HTMLCanvasElement) => {
    (sim as any).engine = { timing: { lastDelta: 16.6 } } as any;
    (sim as any).world = {} as any;
    (sim as any).W = (canvas.width ||= 640);
    (sim as any).H = (canvas.height ||= 360);
  }),
  clearWorld: vi.fn(() => {
    (sim as any).engine = null;
    (sim as any).world = null;
  }),
}));
vi.mock('../app/collisions', () => ({ registerCollisions: vi.fn(() => vi.fn()) }));
vi.mock('../app/devKeys', () => ({ attachDevHotkeys: vi.fn(() => vi.fn()) }));
vi.mock('../app/stats', () => ({ startNewMatch: vi.fn() }));
vi.mock('../app/systems/announcer', () => ({ runAnnouncer: vi.fn() }));
vi.mock('../app/systems/audioMonitors', () => ({ runAudioMonitors: vi.fn() }));
vi.mock('../app/systems/fx', () => ({ runFXPrune: vi.fn() }));
vi.mock('../app/systems/match', () => ({ checkTimeLimit: vi.fn(), maybeEndMatch: vi.fn() }));
vi.mock('../app/systems/physics', () => ({ runPhysics: vi.fn() }));
vi.mock('../app/systems/spawn', () => ({ runSpawn: vi.fn() }));
vi.mock('../app/systems/triggers', () => ({ runTriggers: vi.fn() }));

// Banter minimal
vi.mock('../banter', () => ({
  BanterSystem: class { constructor(_o: any) {} step() {} },
  createCharacter: vi.fn((side: 'left'|'right', p: any, name: string) => ({ id: side, personality: p, displayName: name })),
}));
vi.mock('../ui/banterControls', () => ({ readBanterPacing: vi.fn(() => ({ cooldownMs: 5000, sideMinGapMs: 12000 })) }));
vi.mock('../ui/characters', () => ({ readCharacterProfiles: vi.fn(() => null) }));
vi.mock('../audio', () => ({
  audio: {
    preloadAll: vi.fn(),
    hasPlaylist: vi.fn(() => false),
    isMusicPlaying: vi.fn(() => false),
    setMusicPlaylist: vi.fn(),
    playMusic: vi.fn(),
    stopLoop: vi.fn(),
  },
}));

import { startGame } from '../app/game';
import * as M from 'matter-js';
import { sim } from '../state';

// simple 2D context stub
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy(
    { canvas, measureText: () => ({ width: 0 }) },
    { get: (t, p) => (p in t ? (t as any)[p] : NOOP) },
  ) as unknown as CanvasRenderingContext2D;
}

describe('maybeMirrorArena mirrors bodies, cores, weapons, and bins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="hud"><span id="fps"></span><div id="score"></div></div><canvas id="c" width="640" height="360"></canvas>';
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => (type === '2d' ? ctxStub(canvas) : null));
    (globalThis as any).requestAnimationFrame = vi.fn(() => 1);
    (globalThis as any).cancelAnimationFrame = vi.fn();

    // Provide one world body to be mirrored by x
    (M.Composite.allBodies as any).mockReturnValue([{ position: { x: 100, y: 50 } }]);

    // Enable mirror mode and stable seed
    (sim as any).settings = { seed: 123, mirrorArena: true } as any;
  });

  it('mirrors positions across vertical center (W - x)', () => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const stop = startGame(canvas);

    const W = sim.W;
    // Composite bodies mirrored
    expect((M.Body.setPosition as any)).toHaveBeenCalledWith(expect.any(Object), { x: W - 100, y: 50 });

    // Core centers mirrored
    expect(sim.coreL!.center.x).toBe(W - 10);
    expect(sim.coreR!.center.x).toBe(W - 10);

    // Weapon mounts mirrored
    expect((sim.wepL as any).cannon.pos.x).toBe(W - 5);
    expect((sim.wepL as any).laser.pos.x).toBe(W - 15);
    expect((sim.wepL as any).missile.pos.x).toBe(W - 25);
    expect((sim.wepL as any).mortar.pos.x).toBe(W - 35);

    // Bin model and bodies mirrored
    expect((sim.binsL as any).A.pos.x).toBe(W - 30);
    // Body.setPosition called for box and intake with mirrored x
    expect((M.Body.setPosition as any)).toHaveBeenCalledWith(expect.objectContaining({ position: expect.any(Object) }), { x: W - 30, y: 7 });
    expect((M.Body.setPosition as any)).toHaveBeenCalledWith(expect.objectContaining({ position: expect.any(Object) }), { x: W - 40, y: 9 });

    stop();
  });
});
