import Matter from 'matter-js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../app/systems/physics', () => ({ runPhysics: vi.fn() }));
vi.mock('../app/systems/fx', () => ({ runFXPrune: vi.fn() }));
vi.mock('../app/systems/spawn', () => ({ runSpawn: vi.fn() }));
vi.mock('../app/systems/triggers', () => ({ runTriggers: vi.fn() }));
vi.mock('../app/systems/match', () => ({ checkTimeLimit: vi.fn(), maybeEndMatch: vi.fn() }));
vi.mock('../app/devKeys', () => ({ attachDevHotkeys: () => () => {} }));
vi.mock('../app/stats', () => ({ startNewMatch: vi.fn() }));

import { runPhysics } from '../app/systems/physics';
import { runFXPrune } from '../app/systems/fx';
import { runSpawn } from '../app/systems/spawn';
import { runTriggers } from '../app/systems/triggers';
import { checkTimeLimit, maybeEndMatch } from '../app/systems/match';

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

describe('game beforeUpdate loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
    document.body.innerHTML = '<div id="hud"><span id="fps"></span><div id="score"></div></div><canvas id="c" width="640" height="360"></canvas>';
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => (type === '2d' ? ctxStub(canvas) : null));
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

  it('applies timescale multiplier to dt', () => {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const stop = startGame(canvas);
    // set lastDelta and timescale
    sim.engine!.timing.lastDelta = 20 as any;
    (sim as any).settings.timescale = 1.5;
    Matter.Events.trigger(sim.engine as any, 'beforeUpdate', {} as any);
    expect(runPhysics).toHaveBeenCalled();
    const dt = (runPhysics as any).mock.calls[0][0];
    expect(dt).toBeCloseTo(30, 3);
    expect(checkTimeLimit).toHaveBeenCalled();
    expect(runFXPrune).toHaveBeenCalled();
    expect(runSpawn).toHaveBeenCalled();
    expect(runTriggers).toHaveBeenCalled();
    expect(maybeEndMatch).toHaveBeenCalled();
    stop();
  });
});

