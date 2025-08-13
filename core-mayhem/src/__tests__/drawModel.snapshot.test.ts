import { describe, it, expect } from 'vitest';

import { toDrawCommands } from '../render/drawModel';
import { sim } from '../state';

describe('toDrawCommands (pure render adapter)', () => {
  it('emits core circle commands at expected positions', () => {
    sim.W = 640 as any;
    sim.H = 360 as any;
    sim.coreL = { center: { x: 100, y: 200 }, ringR: 22 } as any;
    sim.coreR = { center: { x: 540, y: 200 }, ringR: 22 } as any;

    const scene = toDrawCommands();
    const circles = scene.commands.filter((c) => c.kind === 'circle');

    // Just check we have a circle at each core center; ignore r/lineWidth
    expect(circles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'circle', x: 100, y: 200 }),
        expect.objectContaining({ kind: 'circle', x: 540, y: 200 }),
      ]),
    );
  });
});
