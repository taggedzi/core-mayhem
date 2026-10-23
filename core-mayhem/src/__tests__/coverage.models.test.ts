import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStats } from '../app/stats';
import { runAudioMonitors } from '../app/systems/audioMonitors';
import { runFXPrune } from '../app/systems/fx';
import { audio } from '../audio';
import {
  banterToAvatarEmotion,
  buildAvatarCmds,
  resetAvatarState,
  setAvatarEmotion,
} from '../render/avatar';
import { getHudData } from '../render/hudModel';
import { getScoreData } from '../render/scoreModel';
import { resetSimState, sim } from '../state';

import type { AvatarEmotion } from '../render/avatar';

describe('model boundary behavior', () => {
  beforeEach(() => {
    resetSimState();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    resetAvatarState();
  });

  it('prunes missing and malformed legacy effects, including exact expiry', () => {
    const state = sim as any;
    const keys = [
      'fxArm',
      'fxBeams',
      'fxBursts',
      'fxBeam',
      'fxImp',
      'fxSweep',
      'fxSparks',
      'fxBanners',
    ];
    for (const key of keys) state[key] = undefined;
    runFXPrune();
    for (const key of keys) expect(state[key]).toEqual([]);
    for (const key of keys) state[key] = [null, {}, { until: 100, tEnd: 100, t0: 0, ms: 100 }];
    runFXPrune(100);
    for (const key of keys) expect(state[key]).toEqual([]);
  });

  it('uses zero HP and score defaults before cores or statistics exist', () => {
    sim.coreL = null as any;
    sim.coreR = null as any;
    resetStats();
    (sim as any).stats = undefined;
    expect(getHudData()).toEqual({ leftHp: '0|Σ0', rightHp: '0|Σ0', state: 'Idle' });
    expect(getScoreData()).toEqual({ leftWins: 0, rightWins: 0, ties: 0 });
    sim.coreL = { centerHP: 10 } as any;
    sim.coreR = { centerHP: 0 } as any;
    expect(getHudData().state).toBe('Game Over');
  });

  it.each([
    null,
    {},
    { centerHP: 0, centerHPmax: 0 },
    { centerHP: 50, centerHPmax: 100 },
    { centerHP: 10, centerHPmax: 100 },
  ])('starts alarms only for living cores below the HP threshold: %j', (core) => {
    const start = vi.spyOn(audio, 'startLoop').mockImplementation(() => {});
    const stop = vi.spyOn(audio, 'stopLoop').mockImplementation(() => {});
    sim.coreL = core as any;
    sim.coreR = core as any;
    runAudioMonitors();
    if (core?.centerHP === 10) {
      expect(start).toHaveBeenCalledTimes(2);
      expect(stop).not.toHaveBeenCalled();
    } else {
      expect(stop).toHaveBeenCalledTimes(2);
      expect(start).not.toHaveBeenCalled();
    }
  });

  it.each<AvatarEmotion>([
    'idle',
    'entrance',
    'taunt',
    'flinch',
    'near_death',
    'powerup',
    'victory',
    'dead',
  ])('draws finite commands and distinct faces for %s', (emotion) => {
    // Expire the initial entrance before requesting lower-priority emotions.
    buildAvatarCmds(2000, 1200, 900);
    setAvatarEmotion('L', emotion);
    setAvatarEmotion('R', emotion);
    const commands = buildAvatarCmds(200, 1200, 900);
    expect(commands.length).toBeGreaterThan(30);
    for (const command of commands) {
      for (const value of Object.values(command)) {
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      }
    }
    const fills = commands.filter((c) => 'fill' in c).map((c) => (c as any).fill);
    if (emotion === 'victory') expect(fills).toContain('#ffd700');
    if (emotion === 'flinch') expect(fills).toContain('#ff2020');
    if (emotion === 'dead') expect(fills).toContain('#777777');
    if (emotion === 'near_death') expect(fills).toContain('#3399ff');
  });

  it('keeps sticky victory above taunts and expires timed flinches', () => {
    setAvatarEmotion('L', 'victory');
    setAvatarEmotion('L', 'taunt');
    expect(buildAvatarCmds(5000, 1200, 900).some((c) => (c as any).fill === '#ffd700')).toBe(true);
    resetAvatarState();
    setAvatarEmotion('L', 'flinch');
    expect(buildAvatarCmds(1500, 1200, 900).some((c) => (c as any).fill === '#ff2020')).toBe(false);
  });

  it.each([0, 0.5])('draws low-HP sweat with and without random jitter (%s)', (random) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    sim.coreL = { centerHP: 10, centerHPmax: 100 } as any;
    sim.coreR = { centerHP: 0 } as any;
    const commands = buildAvatarCmds(4000, 1200, 900);
    expect(commands.filter((c) => (c as any).fill === '#3399ff')).toHaveLength(2);
  });

  it.each([
    ['match_start', 'entrance'],
    ['big_hit', 'flinch'],
    ['stagger', 'flinch'],
    ['shields_down', 'flinch'],
    ['armor_break', 'flinch'],
    ['debuffed', 'flinch'],
    ['near_death', 'near_death'],
    ['taunt', 'taunt'],
    ['first_blood', 'taunt'],
    ['comeback', 'powerup'],
    ['shields_up', 'powerup'],
    ['repair', 'powerup'],
    ['unknown', null],
  ])('maps %s to %s', (event, emotion) => {
    expect(banterToAvatarEmotion(event)).toBe(emotion);
  });
});
