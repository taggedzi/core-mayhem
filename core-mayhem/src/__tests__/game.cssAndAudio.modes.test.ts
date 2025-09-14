import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for heavy deps and systems touched by startGame
vi.mock('matter-js', () => ({
  Events: { on: vi.fn(), off: vi.fn(), trigger: (_: any, __: any, ___: any) => {} },
  Body: { setPosition: vi.fn() },
  Composite: { allBodies: vi.fn(() => []) },
}));
vi.mock('../render/draw', () => ({ drawFrame: vi.fn() }));
vi.mock('../render/hud', () => ({ updateHUD: vi.fn() }));
vi.mock('../render/score', () => ({ updateScoreboard: vi.fn() }));
vi.mock('../sim/channels', () => ({ buildLanes: vi.fn() }));
vi.mock('../sim/containers', () => ({ makeBins: vi.fn(() => ({})), nudgeBinsFromPipes: vi.fn() }));
// Capture color arg via mock (defined inside factory)
vi.mock('../sim/core', () => {
  const makeCore = vi.fn((w: any, side: any, color: string) => ({ center: { x: side === 'L' ? 10 : 20, y: 0 }, color }));
  return { makeCore };
});
vi.mock('../sim/obstacles', () => ({ makePipe: vi.fn(() => ({ innerX: 0 })), placeObstaclesFromSpecs: vi.fn() }));
vi.mock('../sim/pins', () => ({ makePins: vi.fn(() => ({ mid: 0, width: 0 })) }));
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

// Banter basics
vi.mock('../banter', () => ({
  BanterSystem: class { constructor(_o: any) {} step() {} },
  createCharacter: vi.fn((side: 'left'|'right', p: any, name: string) => ({ id: side, personality: p, displayName: name })),
}));

// No need to mock personas for these tests

// Audio mock with stateful hasPlaylist (self-contained in factory)
vi.mock('../audio', () => {
  let playlist: string[] = [];
  const audio = {
    preloadAll: vi.fn(),
    hasPlaylist: vi.fn(() => playlist.length > 0),
    isMusicPlaying: vi.fn(() => false),
    setMusicPlaylist: vi.fn((urls: string[]) => { playlist = urls.slice(); }),
    playMusic: vi.fn(),
    stopLoop: vi.fn(),
    setAnnouncerVolume: vi.fn(),
    duck: vi.fn(), duckSfx: vi.fn(), playUrl: vi.fn(), stopAnnouncer: vi.fn(),
  } as const;
  return { audio };
});

import { startGame } from '../app/game';
import { makeCore as mockMakeCore } from '../sim/core';
import { audio as mockedAudio } from '../audio';
import { sim } from '../state';

// simple 2D context stub
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy(
    { canvas, measureText: () => ({ width: 0 }) },
    { get: (t, p) => (p in t ? (t as any)[p] : NOOP) },
  ) as unknown as CanvasRenderingContext2D;
}

describe('game css vars and audio init', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    // reset tracked playlist state via mock fns
    (mockedAudio.setMusicPlaylist as any).mockClear();
    (mockedAudio.playMusic as any).mockClear();
    // DOM
    document.body.innerHTML = '<div id="hud"><span id="fps"></span><div id="score"></div></div><canvas id="c" width="640" height="360"></canvas>';
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => (type === '2d' ? ctxStub(canvas) : null));

    // requestAnimationFrame/cancelAnimationFrame stubs
    (globalThis as any).requestAnimationFrame = vi.fn(() => 1);
    (globalThis as any).cancelAnimationFrame = vi.fn();

    // Stable seed
    (sim as any).settings = { seed: 123, mirrorArena: false } as any;
  });

  it('passes trimmed CSS color vars to makeCore', () => {
    const getComputed = vi.spyOn(window, 'getComputedStyle');
    getComputed.mockReturnValue({ getPropertyValue: (name: string) => (name === '--left' ? '  #abc  ' : '  #def  ') } as any);

    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const stop = startGame(canvas);

    // makeCore called twice with trimmed colors
    expect((mockMakeCore as any)).toHaveBeenCalledTimes(2);
    const colors = (mockMakeCore as any).mock.calls.map((c: any[]) => c[2]);
    expect(colors).toContain('#abc');
    expect(colors).toContain('#def');

    stop();
    getComputed.mockRestore();
  });

  it('initializes music playlist and starts playback when WebAudio is available', async () => {
    // Pretend WebAudio available
    (window as any).AudioContext = function () {} as any;
    // Mock fetch for playlist.json and HEAD probe
    const fetchMock = vi.fn()
      // playlist.json
      .mockResolvedValueOnce({ ok: true, json: async () => ['song1.mp3', 'song2.ogg', 'note.txt'] })
      // The code only probes main_theme if no playlist; our playlist exists so this call may not happen.
      .mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock as any;

    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const stop = startGame(canvas);

    // Allow async IIFE to run
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedAudio.setMusicPlaylist).toHaveBeenCalled();
    expect(mockedAudio.hasPlaylist()).toBe(true);
    expect(mockedAudio.playMusic).toHaveBeenCalled();

    stop();
  });
});
