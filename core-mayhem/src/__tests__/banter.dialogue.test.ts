import { describe, expect, it } from 'vitest';

import { BanterSystem, createCharacter, type BanterEvent, type Personality } from '../banter';
import { PERSONA_CATALOG } from '../banter/personas';

const personality: Personality = {
  name: 'Test speaker',
  aggression: 1,
  optimism: 1,
  humor: 1,
  sarcasm: 1,
  formality: 1,
  quirks: { ellipsis: 1, staccato: 1, randomCaps: 1, emojiStyle: 'emoji', emoji: 1 },
  lexicon: {
    greet: ["I'm ready. Are you?"],
    hype: ['That hit landed!'],
    pain: ['Ow, you caught me.'],
    comeback: ["I'm back in this."],
    nearDeath: ['I can barely stand.'],
    tauntSoft: ['Try keeping up.'],
    tauntHard: ['You cannot stop me.'],
    victory: ['The match is mine.'],
    emojisPositive: ['😎'],
    emojisNegative: ['🤕'],
  },
};

function sample(event: BanterEvent, p = personality, count = 30): string[] {
  const system = new BanterSystem({ seed: 47, cooldownMs: 60_000 });
  const me = createCharacter('L', p, 'Speaker');
  const them = createCharacter('R', personality, 'Opponent');
  return Array.from({ length: count }, () => system.speak(event, me, them)!.text);
}

describe('deterministic dialogue clarity', () => {
  it('preserves authored grammar despite legacy punctuation quirks', () => {
    expect(new Set(sample('match_start'))).toEqual(new Set(["I'm ready. Are you? 😎"]));
  });

  it.each(['first_blood', 'big_hit'] as const)(
    '%s celebrates the attacker, including fallback',
    (event) => {
      expect(new Set(sample(event))).toEqual(new Set(['That hit landed! 😎']));
    },
  );

  it('uses the injured speaker perspective for stagger reactions', () => {
    const lines = sample('stagger');
    expect(lines).toContain('Ow, you caught me. 🤕');
    expect(lines.every((line) => line.endsWith('🤕'))).toBe(true);
    expect(lines.some((line) => line.includes('That hit landed'))).toBe(false);
  });

  it('keeps comeback and near-death lines in the correct perspective', () => {
    expect(new Set(sample('comeback'))).toEqual(new Set(["I'm back in this. 😎"]));
    expect(new Set(sample('near_death'))).toEqual(new Set(['I can barely stand. 🤕']));
  });

  it.each(['💅🏆', 'Nice hit! ✨'])('preserves an authored emoji line: %s', (line) => {
    const p = { ...personality, lexicon: { ...personality.lexicon, greet: [line] } };
    expect(new Set(sample('match_start', p))).toEqual(new Set([line]));
  });

  it('does not append blank or missing emoji entries', () => {
    for (const emojisPositive of [[], ['', ' ']]) {
      const p = { ...personality, lexicon: { ...personality.lexicon, emojisPositive } };
      expect(sample('match_start', p, 1)).toEqual(["I'm ready. Are you?"]);
    }
  });

  it('keeps confident taunts free of injury reactions', () => {
    expect(sample('taunt').every((line) => line.endsWith('😎'))).toBe(true);
  });

  it('does not imply every debuff is a slow or every repair is a full heal', () => {
    expect(sample('debuffed').join(' ')).not.toMatch(/slowed|slower|slugged/i);
    expect(sample('repair').join(' ')).not.toMatch(/good as new|healed|repairs complete/i);
  });

  it('replays the same sequence for the same seed', () => {
    expect(sample('taunt')).toEqual(sample('taunt'));
  });

  it('keeps every persona playable across all dialogue events', () => {
    const events: BanterEvent[] = [
      'match_start',
      'first_blood',
      'big_hit',
      'stagger',
      'comeback',
      'near_death',
      'victory',
      'taunt',
      'shields_down',
      'armor_break',
      'shields_up',
      'repair',
      'debuffed',
    ];
    for (const p of Object.values(PERSONA_CATALOG)) {
      for (const event of events) {
        for (const line of sample(event, p, 3)) {
          expect(line.trim(), `${p.name}: ${event}`).not.toBe('');
          expect(line).not.toMatch(/undefined|\[object Object\]/);
        }
      }
    }
  });
  it('applies pacing changes to an existing system immediately', () => {
    const system = new BanterSystem({ seed: 47, cooldownMs: 10000, sideMinGapMs: 10000 });
    const me = createCharacter('L', personality, 'Speaker');
    const them = createCharacter('R', personality, 'Opponent');
    expect(system.speak('match_start', me, them)).not.toBeNull();
    system.step(100);
    expect(system.speak('taunt', me, them)).toBeNull();
    system.updatePacing({ cooldownMs: 500, sideMinGapMs: 0 });
    expect(system.speak('taunt', me, them)).not.toBeNull();
  });
});
