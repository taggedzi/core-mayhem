import { describe, it, expect, beforeEach } from 'vitest';

import Matter from 'matter-js';
import { buildLanes } from '../sim/channels';
import { sim, resetSimState } from '../state';

describe('buildLanes', () => {
  beforeEach(() => {
    resetSimState();
    // minimal dimensions
    sim.W = 640 as any;
    sim.H = 360 as any;
    const eng = Matter.Engine.create();
    sim.world = eng.world;
  });

  it('creates 4 lanes with walls and dampers', () => {
    const width = 240; // leaves some margin on a 640 screen
    const mid = sim.W / 2;
    const { lanes, gap, walls } = buildLanes(sim.world as any, mid, width);
    expect(lanes).toBe(4);
    expect(gap).toBeCloseTo(width / 4, 5);
    // 2 walls per lane + 1 tall inner guard
    expect(walls.length).toBe(4 * 2 + 1);
    // one gel/damper slab per lane
    expect(sim.gels.length).toBe(4);
  });
});

