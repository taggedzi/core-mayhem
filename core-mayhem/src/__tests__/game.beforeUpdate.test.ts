import Matter from 'matter-js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../app/systems/physics', () => ({ runPhysics: vi.fn() }));
vi.mock('../app/systems/fx', () => ({ runFXPrune: vi.fn() }));
vi.mock('../app/systems/spawn', () => ({ runSpawn: vi.fn() }));
vi.mock('../app/systems/triggers', () => ({ runTriggers: vi.fn() }));
vi.mock('../app/systems/match', () => ({ checkTimeLimit: vi.fn(), maybeEndMatch: vi.fn() }));
vi.mock('../app/devKeys', () => ({ attachDevHotkeys: () => () => {} }));
vi.mock('../app/stats', () => ({
  startNewMatch: vi.fn(),
  abortOpenMatch: vi.fn(),
  initStats: vi.fn(),
  getSummary: vi.fn(() => ({
    matches: 0,
    leftWins: 0,
    rightWins: 0,
    ties: 0,
    buffsL: 0,
    buffsR: 0,
    debuffsL: 0,
    debuffsR: 0,
  })),
}));

import { startGame } from '../app/game';
import { checkTimeLimit } from '../app/systems/match';
import { runPhysics } from '../app/systems/physics';
import { runSpawn } from '../app/systems/spawn';
import { runTriggers } from '../app/systems/triggers';
import { sim, resetSimState } from '../state';

// simple 2D context stub
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy(
    { canvas, measureText: () => ({ width: 0 }) },
    { get: (t, p) => (p in t ? (t as any)[p] : NOOP) },
  ) as unknown as CanvasRenderingContext2D;
}

describe('game beforeUpdate loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
    document.body.innerHTML =
      '<div id="hud"><span id="fps"></span><div id="score"></div></div><canvas id="c" width="640" height="360"></canvas>';
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) =>
      type === '2d' ? ctxStub(canvas) : null,
    );
    // seed css vars
    document.documentElement.style.setProperty('--left', '#5cf');
    document.documentElement.style.setProperty('--right', '#f76');
  });

  it('skips logic when gameOver is true', async () => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const stop = startGame(canvas);
    sim.gameOver = true as any;
    // trigger one beforeUpdate manually with a fixed delta
    sim.engine!.timing.lastDelta = 20 as any;
    Matter.Events.trigger(sim.engine as any, 'beforeUpdate', {} as any);
    expect(runPhysics).not.toHaveBeenCalled();
    expect(runSpawn).not.toHaveBeenCalled();
    stop();
  });

  it.each([0.5, 1, 3])('applies %sx simulation time exactly once', (timescale) => {
    vi.clearAllMocks();
    sim.settings.timescale = timescale;
    const stop = startGame(document.getElementById('c') as HTMLCanvasElement);
    const engine = sim.engine!;
    Matter.Engine.update(engine, 20);
    expect(runPhysics).toHaveBeenCalledWith(20 * timescale);
    expect(runSpawn).toHaveBeenCalledWith(20 * timescale);
    expect(engine.timing.lastDelta).toBeCloseTo(20 * timescale);
    expect(runTriggers).toHaveBeenCalledTimes(1);
    stop();
  });

  it('advances core rotation by elapsed simulation time', async () => {
    const { runPhysics: realPhysics } = await vi.importActual<{
      runPhysics: (dtMs: number) => void;
    }>('../app/systems/physics');
    sim.engine = Matter.Engine.create();
    sim.world = sim.engine.world;
    sim.coreL = { rot: 0, rotSpeed: 0.01 } as any;
    sim.coreR = { rot: 0, rotSpeed: -0.01 } as any;
    realPhysics(1000 / 60);
    realPhysics(1000 / 30);
    expect(sim.coreL!.rot).toBeCloseTo(0.03);
    expect(sim.coreR!.rot).toBeCloseTo(-0.03);
  });

  it('runs no gameplay after the time limit declares a result', () => {
    vi.clearAllMocks();
    const stop = startGame(document.getElementById('c') as HTMLCanvasElement);
    vi.mocked(checkTimeLimit).mockImplementationOnce(() => {
      sim.gameOver = true;
    });
    Matter.Events.trigger(sim.engine!, 'beforeUpdate', {});
    expect(runPhysics).not.toHaveBeenCalled();
    expect(runSpawn).not.toHaveBeenCalled();
    expect(runTriggers).not.toHaveBeenCalled();
    stop();
  });
});
