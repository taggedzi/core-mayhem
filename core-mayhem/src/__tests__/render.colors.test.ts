import { describe, it, expect } from 'vitest';

import { colorForAmmo } from '../render/colors';

describe('colorForAmmo', () => {
  it('maps known ammo types to specific colors', () => {
    expect(colorForAmmo('heavy')).toBe('#ffca1a');
    expect(colorForAmmo('volatile')).toBe('#ff3d3d');
    expect(colorForAmmo('emp')).toBe('#00ffd5');
    expect(colorForAmmo('repair')).toBe('#6bffb8');
    expect(colorForAmmo('shield')).toBe('#9fc5ff');
  });

  it('falls back for unknown types', () => {
    expect(colorForAmmo('basic')).toBe('#b6ff00');
    expect(colorForAmmo('something-else')).toBe('#b6ff00');
  });
});

