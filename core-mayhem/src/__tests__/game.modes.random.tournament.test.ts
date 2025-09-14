import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Matter and world plumbing
vi.mock('matter-js', () => ({
  Events: { on: vi.fn(), off: vi.fn(), trigger: (_: any, __: any, ___: any) => {} },
  Body: { setPosition: vi.fn() },
  Composite: { allBodies: vi.fn(() => []) },
}));
vi.mock('../sim/world', () => ({
  initWorld: vi.fn((canvas: HTMLCanvasElement) => {
    (sim as any).engine = { timing: { lastDelta: 16 } } as any;
    (sim as any).world = {} as any;
    (sim as any).W = (canvas.width ||= 640);
    (sim as any).H = (canvas.height ||= 360);
  }),
  clearWorld: vi.fn(() => { (sim as any).engine = null; (sim as any).world = null; }),
}));

// Light mocks for render/systems used by startGame
vi.mock('../render/draw', () => ({ drawFrame: vi.fn() }));
vi.mock('../render/hud', () => ({ updateHUD: vi.fn() }));
vi.mock('../render/score', () => ({ updateScoreboard: vi.fn() }));
vi.mock('../sim/channels', () => ({ buildLanes: vi.fn() }));
vi.mock('../sim/containers', () => ({ makeBins: vi.fn(() => ({})), nudgeBinsFromPipes: vi.fn() }));
vi.mock('../sim/core', () => ({ makeCore: vi.fn(() => ({ center: { x: 0, y: 0 } })) }));
vi.mock('../sim/obstacles', () => ({ makePipe: vi.fn(() => ({ innerX: 0 })), placeObstaclesFromSpecs: vi.fn() }));
vi.mock('../sim/pins', () => ({ makePins: vi.fn(() => ({ mid: 0, width: 0 })) }));
vi.mock('../sim/weapons', () => ({ makeWeapons: vi.fn(() => ({
  cannon: { pos: { x: 0, y: 0 } },
  laser: { pos: { x: 0, y: 0 } },
  missile: { pos: { x: 0, y: 0 } },
  mortar: { pos: { x: 0, y: 0 } },
})) }));
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

// Banter basics
vi.mock('../banter', () => ({
  BanterSystem: class { constructor(_o: any) {} step() {} },
  createCharacter: vi.fn((side: 'left'|'right', p: any, name: string) => ({ id: side, personality: p, displayName: name })),
}));

// Audio: keep WebAudio path inactive
vi.mock('../audio', () => ({ audio: { preloadAll: vi.fn(), hasPlaylist: vi.fn(() => false), isMusicPlaying: vi.fn(() => false), setMusicPlaylist: vi.fn(), playMusic: vi.fn(), stopLoop: vi.fn() } }));

import { startGame } from '../app/game';
import { sim, resetSimState } from '../state';

// simple 2D context stub
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy(
    { canvas, measureText: () => ({ width: 0 }) },
    { get: (t, p) => (p in t ? (t as any)[p] : NOOP) },
  ) as unknown as CanvasRenderingContext2D;
}

const labelFromKey = (k: string) => k.replace(/\s*Core$/i, '').trim();

describe('persona selection modes (random, tournament)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSimState();
    document.body.innerHTML = '<div id="hud"><span id="fps"></span><div id="score"></div></div><canvas id="c" width="640" height="360"></canvas>';
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => (type === '2d' ? ctxStub(canvas) : null));
    (globalThis as any).requestAnimationFrame = vi.fn(() => 1);
    (globalThis as any).cancelAnimationFrame = vi.fn();
    // Avoid WebAudio playlist path
    (window as any).AudioContext = undefined;
    // Stable seed
    (sim as any).settings = { seed: 42 } as any;
    // Ensure clean tournament bucket
    delete (sim as any).tournament;
  });

  it('random mode picks two distinct personas and saves profiles', async () => {
    localStorage.setItem('cm_game_mode', 'random');
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const stop = startGame(canvas);

    const kL = (sim as any).matchPersonaL as string;
    const kR = (sim as any).matchPersonaR as string;
    expect(typeof kL).toBe('string');
    expect(typeof kR).toBe('string');
    expect(kL).not.toBe(kR);

    // Label applied to characters
    expect((sim as any).banterL?.displayName).toBe(labelFromKey(kL));
    expect((sim as any).banterR?.displayName).toBe(labelFromKey(kR));

    // Saved to localStorage
    const savedL = JSON.parse(localStorage.getItem('cm_char_L') || '{}');
    const savedR = JSON.parse(localStorage.getItem('cm_char_R') || '{}');
    expect(savedL.persona).toBe(kL);
    expect(savedR.persona).toBe(kR);

    stop();
  });

  it('tournament mode alternates sides for the same pair across matches', async () => {
    localStorage.setItem('cm_game_mode', 'tournament');
    const canvas = document.getElementById('c') as HTMLCanvasElement;

    const stop1 = startGame(canvas);
    const L1 = (sim as any).matchPersonaL as string;
    const R1 = (sim as any).matchPersonaR as string;
    expect(typeof L1).toBe('string');
    expect(typeof R1).toBe('string');
    expect(L1).not.toBe(R1);
    stop1();

    // Start second match, index same pair, matchIndex increments -> even -> left should be aKey
    const stop2 = startGame(canvas);
    const L2 = (sim as any).matchPersonaL as string;
    const R2 = (sim as any).matchPersonaR as string;
    expect(L2).toBe(R1);
    expect(R2).toBe(L1);
    stop2();
  });
});
