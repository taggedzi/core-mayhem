import { Bodies, Engine } from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildLanes } from '../sim/channels';
import { makeBins, nudgeBinsFromPipes } from '../sim/containers';
import { resetSimState, sim } from '../state';
import { SIDE } from '../types';

describe('container positioning guards', () => {
  beforeEach(() => {
    resetSimState();
    sim.world = Engine.create().world;
  });

  it.each([undefined, {}, { innerX: NaN }, { innerX: 'invalid' }])(
    'ignores unavailable pipe geometry: %j',
    (pipe) => {
      sim.pipes = [pipe, pipe] as any;
      const box = Bodies.rectangle(0, 0, 10, 10);
      nudgeBinsFromPipes(SIDE.LEFT, { test: { box } });
      expect(box.position.x).toBe(0);
    },
  );

  it('ignores unavailable bins and pipes', () => {
    nudgeBinsFromPipes(SIDE.LEFT, null);
    sim.pipes = undefined as any;
    nudgeBinsFromPipes(SIDE.RIGHT, {});
    sim.pipes = [];
  });

  it.each([SIDE.LEFT, SIDE.RIGHT])(
    'moves walls, intakes, and logical positions together on side %s',
    (side) => {
      sim.pipes = [{ innerX: 100 }, { innerX: 100 }] as any;
      const box = Bodies.rectangle(100, 30, 20, 10);
      const intake = Bodies.rectangle(100, 20, 20, 5);
      const pos = { x: 100, y: 30 };
      nudgeBinsFromPipes(side, {
        normal: { box, intake, pos },
        absent: null,
        empty: {},
        bodyOnly: { body: Bodies.rectangle(100, 20, 20, 5) },
      });
      const expected = side === SIDE.LEFT ? 115 : 85;
      expect(box.position.x).toBe(expected);
      expect(intake.position.x).toBe(expected);
      expect(pos.x).toBe(expected);
      nudgeBinsFromPipes(side, { normal: { box, intake, pos } });
      expect(pos.x).toBe(expected);
      const onlyIntake = Bodies.rectangle(100, 20, 20, 5);
      nudgeBinsFromPipes(side, { intakeOnly: { intake: onlyIntake } });
      expect(onlyIntake.position.x).toBe(expected);
    },
  );

  it('fails fast when world-dependent builders run before initialization', () => {
    sim.world = null;
    expect(() => makeBins(SIDE.LEFT, 0, 0)).toThrow('World not initialized');
    expect(() => buildLanes(null as any, 100, 100)).toThrow('World not initialized');
  });
});
