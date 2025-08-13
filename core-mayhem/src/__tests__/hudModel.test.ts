import { describe, it, expect } from 'vitest';

import { getHudData } from '../render/hudModel';
import { sim } from '../state';

describe('getHudData (pure)', () => {
  it('summarizes HP, segments, and state', () => {
    sim.started = true;
    sim.coreL = { centerHP: 50, segHP: [10, 20, 30] } as any;
    sim.coreR = { centerHP: 48, segHP: [8, 12, 16] } as any;

    const hud = getHudData();
    expect(hud.leftHp).toBe('50|Σ60');
    expect(hud.rightHp).toBe('48|Σ36');
    expect(hud.state).toBe('Running');
  });

  it('reports Game Over when either core is dead', () => {
    sim.started = true;
    sim.coreL = { centerHP: 0, segHP: [] } as any;
    sim.coreR = { centerHP: 10, segHP: [] } as any;

    const hud = getHudData();
    expect(hud.state).toBe('Game Over');
  });
});
