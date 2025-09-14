// Lightweight, deterministic banter system for two cores
// Self-contained: no external deps. Deterministic via seeded RNG.

export type BanterEvent =
  | 'match_start'
  | 'first_blood'
  | 'big_hit'
  | 'stagger'
  | 'comeback'
  | 'near_death'
  | 'victory'
  | 'taunt'
  // New targeted/reactive events
  | 'shields_down'      // my shields just collapsed
  | 'armor_break'       // I lost an armor segment
  | 'shields_up'        // I raised shields / got shield pickup
  | 'repair'            // I repaired armor
  | 'debuffed';         // I was debuffed by opponent

// 'unicode' is accepted as an alias of 'emoji' for convenience in persona files
export type EmojiStyle = 'none' | 'emoji' | 'kaomoji' | 'unicode';

export interface Personality {
  name: string;
  // Optional long-form persona description for LLM context
  blurb?: string;
  // Trait intensities 0..1
  aggression: number;
  humor: number;
  formality: number; // 0 informal -> 1 formal
  optimism: number;
  sarcasm: number;
  // Quirks probabilities 0..1
  quirks?: {
    ellipsis: number; // chance to end with ...
    staccato: number; // chance to add short stops
    randomCaps: number; // chance to randomly UPPERCASE a word
    emojiStyle: EmojiStyle;
    emoji: number; // chance to add emoji/kaomoji
  };
  // Optional custom lexicon additions/overrides
  lexicon?: Partial<Lexicon>;
}

export interface Character {
  id: string; // unique per core (e.g. "left", "right")
  displayName?: string;
  personality: Personality;
}

export interface BanterOptions {
  seed?: number; // deterministic seed
  cooldownMs?: number; // cooldown per template per speaker
  sideMinGapMs?: number; // minimum gap between any two lines per speaker
}

export interface SpeakResult {
  speaker: string;
  text: string;
  event: BanterEvent;
}

// Simple deterministic RNG (Mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Weighted random pick helper
function pickWeighted<T>(rng: () => number, items: { item: T; w: number }[]): T {
  if (items.length === 0) throw new Error('pickWeighted: empty items');
  const total = items.reduce((s, it) => s + (it.w > 0 ? it.w : 0), 0);
  if (total <= 0) return items[0]!.item;
  let roll = rng() * total;
  for (const it of items) {
    const w = it.w > 0 ? it.w : 0;
    if (roll < w) return it.item;
    roll -= w;
  }
  return items[items.length - 1]!.item;
}

// Shuffle in-place (Fisher-Yates) using seeded rng
function shuffleInPlace<T>(rng: () => number, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = arr[i]!;
    const aj = arr[j]!;
    arr[i] = aj;
    arr[j] = ai;
  }
}

// Small base lexicon and templates. Expandable later.
export type Lexicon = {
  greet: string[];
  hype: string[];
  tauntSoft: string[]; // playful
  tauntHard: string[]; // aggressive
  praise: string[];
  pain: string[];
  comeback: string[];
  nearDeath: string[];
  victory: string[];
  emojisPositive: string[];
  emojisNegative: string[];
  kaomojiPositive: string[];
  kaomojiNegative: string[];
};

// const BASE_LEXICON: Lexicon = {
//   greet: ["Ready.", "Booted.", "Online.", "Systems green.", "Let's go."],
//   hype: ["Big play.", "Clean hit.", "Spicy.", "Nice line.", "Good read."],
//   tauntSoft: ["Too slow.", "Keep up.", "Cute.", "Try me.", "I'm warmed up."],
//   tauntHard: ["Break.", "I'm inevitable.", "I'll shred you.", "Submit.", "You're done."],
//   praise: ["Nice shot.", "Respect.", "Solid.", "Clean.", "Well played."],
//   pain: ["Ouch.", "That stung.", "Spiked.", "Took a chunk.", "Systems flickered."],
//   comeback: ["Not over.", "Rally.", "We swing back.", "Momentum flips.", "Hold."] ,
//   nearDeath: ["Low.", "Critical.", "Hull thin.", "Barely holding.", "One ping away."],
//   victory: ["Done.", "Dominated.", "Wrapped.", "Sealed.", "Checkmate."],
//   emojisPositive: ["🎯", "💥", "😎", "🔥", "✨"],
//   emojisNegative: ["😬", "🤕", "💢", "💀", "🧯"],
//   kaomojiPositive: ["( •̀ᴗ•́ )✧", "(ง •̀_•́)ง", "(＾▽＾)", "(ᵔ◡ᵔ)", "(☞ ͡° ͜ʖ ͡°)☞"],
//   kaomojiNegative: ["(>_<)", "(; _ ;)", "(◣_◢)", "(╯°□°）╯", "(ー_ー)!!"],
// };

const BASE_LEXICON: Lexicon = {
  greet: [
    'I was born ready.',
    'Finally—someone worth my time.',
    'Let’s make this quick.',
    'Systems hot, target locked.',
    'Hope you stretched first.',
    'Another victim steps up.',
    'Let’s see how fast you break.',
  ],

  hype: [
    'Ohhh, that had to hurt!',
    'Straight to the face!',
    'Filthy play!',
    'Didn’t see that coming, huh?',
    'That’s how you do it!',
    'Brutal finish!',
    'Clean execution!',
  ],

  tauntSoft: [
    'Too easy.',
    'Yawn… try harder.',
    'That tickled.',
    'Is that your plan? Really?',
    'I’m just warming up.',
    'Don’t fall asleep out here.',
    'You’re making this boring.',
  ],

  tauntHard: [
    'I’ll break you piece by piece.',
    'I’m inevitable—get used to it.',
    'You’re already finished, you just don’t know it yet.',
    'Bow down or get crushed.',
    'Say goodnight.',
    'I’ll grind you into scrap.',
    'You’re nothing but target practice.',
  ],

  praise: [
    'Not bad—for you.',
    'Okay, respect.',
    'That almost impressed me.',
    'Nice shot. Won’t happen again.',
    'Lucky… but credit where it’s due.',
    'I’ll give you that one.',
    'Enjoy it, it won’t last.',
  ],

  pain: [
    'Tch—got me!',
    'That one stung!',
    'Cheap shot!',
    'You’ll pay for that!',
    'Systems… glitching…',
    'Bleeding but not beaten.',
    'That the best pain you can deal?',
  ],

  comeback: [
    'Thought I was done? Cute.',
    'Time to flip the script.',
    'I don’t die easy.',
    'Momentum’s mine now.',
    'This is where it turns.',
    'Your lead won’t save you.',
    'Now you’re in trouble.',
  ],

  nearDeath: [
    'Hah… still standing!',
    'One breath left… make it count.',
    'Barely holding together.',
    'I’m not done yet!',
    'You’ll have to finish the job!',
    'Dripping oil, still deadly.',
    'One more scar for the collection.',
  ],

  victory: [
    'Told you—you never had a chance.',
    'Down you go.',
    'Easy money.',
    'All wrapped up.',
    'You should’ve stayed home.',
    'Pathetic.',
    'Another name crossed off.',
  ],

  emojisPositive: ['😎', '🔥', '💣', '🚀', '👑'],
  emojisNegative: ['🤕', '💀', '😵', '💢', '☠️'],

  kaomojiPositive: ['(•̀ᴗ•́)و ̑̑', '(ง’̀-‘́)ง', '(⌐■_■)', '(≖‿≖)', '(¬‿¬)'],
  kaomojiNegative: ['(×_×)', '(>︵<)', '(ಠ_ಠ)', '(ノಠ益ಠ)ノ彡┻━┻', '(;￣Д￣)'],
};

type Template = {
  id: string; // for cooldown tracking
  build: (ctx: BuildCtx) => string;
  // weight computed per personality; base weight used as multiplier
  baseWeight?: number;
};

type TemplateBook = Record<BanterEvent, Template[]>;

const TEMPLATES: TemplateBook = {
  match_start: [
    { id: 'ms.greet1', build: ({ pick }) => pick('greet') },
    {
      id: 'ms.greet2',
      baseWeight: 1.2,
      build: ({ pick, them }) => `${pick('greet')} ${them}, watching?`,
    },
  ],
  first_blood: [
    {
      id: 'fb.hypeTaunt',
      build: ({ trait, pick }) =>
        trait('aggression') > 0.5
          ? `${pick('hype')} ${pick('tauntHard')}`
          : `${pick('hype')} ${pick('tauntSoft')}`,
    },
    { id: 'fb.clean', build: ({ pick }) => `${pick('hype')}` },
  ],
  big_hit: [
    {
      id: 'bh.bite',
      build: ({ pick, trait }) =>
        trait('sarcasm') > 0.6 ? `${pick('pain')} Sure.` : `${pick('pain')}`,
    },
    {
      id: 'bh.grin',
      baseWeight: 1.1,
      build: ({ pick, trait }) =>
        trait('aggression') > 0.6 ? `More.` : `${pick('pain')} Still here.`,
    },
  ],
  stagger: [
    { id: 'st.hold', build: ({ pick }) => `${pick('pain')} Holding.` },
    { id: 'st.snap', build: ({ trait }) => (trait('sarcasm') > 0.7 ? 'Ow. Comedy gold.' : 'Ow.') },
  ],
  comeback: [
    { id: 'cb.rally', build: ({ pick }) => `${pick('comeback')}` },
    { id: 'cb.push', build: ({ trait }) => (trait('optimism') > 0.6 ? 'We climb.' : 'We scrape.') },
  ],
  near_death: [
    { id: 'nd.brink', build: ({ pick }) => `${pick('nearDeath')}` },
    { id: 'nd.steady', build: ({ trait }) => (trait('optimism') > 0.6 ? 'Steady.' : 'Grim.') },
  ],
  victory: [
    { id: 'vc.short', build: ({ pick }) => `${pick('victory')}` },
    {
      id: 'vc.signoff',
      baseWeight: 1.1,
      build: ({ trait }) => (trait('formality') > 0.6 ? 'Good game.' : 'GG.'),
    },
  ],
  taunt: [
    {
      id: 'tt.softHard',
      build: ({ pick, trait }) =>
        trait('aggression') > 0.55 ? pick('tauntHard') : pick('tauntSoft'),
    },
    { id: 'tt.short', build: ({ pick }) => pick('tauntSoft') },
  ],
  shields_down: [
    { id: 'sd.grit', build: () => 'Shields down—still fighting.' },
    { id: 'sd.snap', build: ({ trait }) => (trait('sarcasm') > 0.6 ? 'Nice. Now come closer.' : 'You broke the shield. So what?') },
  ],
  armor_break: [
    { id: 'ab.snarl', build: ({ pick }) => `${pick('pain')} Lost a plate.` },
    { id: 'ab.defiant', build: ({ trait }) => (trait('aggression') > 0.6 ? 'Rip more. I won’t fold.' : 'Armor’s thinning… I’m fine.') },
  ],
  shields_up: [
    { id: 'su.short', build: () => 'Shield online.' },
    { id: 'su.flex', build: ({ trait }) => (trait('aggression') > 0.6 ? 'Under cover. Try me now.' : 'Back under cover.') },
  ],
  repair: [
    { id: 'rp.brisk', build: () => 'Patched up.' },
    { id: 'rp.composure', build: ({ trait }) => (trait('formality') > 0.6 ? 'Repairs complete.' : 'Good as new.') },
  ],
  debuffed: [
    { id: 'db.irritated', build: () => 'Tch—systems slugged.' },
    { id: 'db.spiky', build: ({ trait }) => (trait('sarcasm') > 0.6 ? 'Cute trick. Timer’s ticking.' : 'Debuff won’t save you.') },
  ],
};

type BuildCtx = {
  me: string;
  them: string;
  trait: (name: keyof Omit<Personality, 'name' | 'quirks' | 'lexicon'>) => number;
  pick: (lex: keyof Lexicon) => string;
  rng: () => number;
};

function mergeLexicon(base: Lexicon, override?: Partial<Lexicon>): Lexicon {
  if (!override) return base;
  const out = { ...base } as any;
  for (const k of Object.keys(override) as (keyof Lexicon)[]) {
    const v = override[k];
    if (!v) continue;
    out[k] = v;
  }
  return out as Lexicon;
}

function applyQuirks(
  rng: () => number,
  line: string,
  p: Personality,
  mood: 'positive' | 'negative' | 'neutral',
  lex: Lexicon,
): string {
  const q = p.quirks ?? { ellipsis: 0, staccato: 0, randomCaps: 0, emojiStyle: 'none', emoji: 0 };

  // Random CAPS for one word
  if (rng() < q.randomCaps && line.length > 3) {
    const words = line.split(/\s+/);
    if (words.length > 0) {
      const idx = Math.floor(rng() * words.length);
      words[idx] = words[idx]!.toUpperCase();
      line = words.join(' ');
    }
  }

  // Staccato: add short stops to 1-2 random spaces
  if (rng() < q.staccato && line.split(' ').length > 2) {
    const parts = line.split(' ');
    const count = 1 + Math.floor(rng() * Math.min(2, Math.floor(parts.length / 3)));
    for (let c = 0; c < count; c++) {
      const at = 1 + Math.floor(rng() * Math.max(1, parts.length - 2));
      parts[at] = parts[at] + '.';
    }
    line = parts.join(' ');
  }

  // Ending ellipsis
  if (rng() < q.ellipsis) {
    if (!line.trim().endsWith('.')) line += '.';
    line += '..';
  }

  // Emoji/kaomoji
  if (q.emojiStyle !== 'none' && rng() < q.emoji) {
    const pos = mood === 'positive';
    const neg = mood === 'negative';
    const pool =
      (q.emojiStyle === 'emoji' || q.emojiStyle === 'unicode')
        ? pos
          ? lex.emojisPositive
          : neg
            ? lex.emojisNegative
            : lex.emojisPositive
        : pos
          ? lex.kaomojiPositive
          : neg
            ? lex.kaomojiNegative
            : lex.kaomojiPositive;
    const em = pool[Math.floor(rng() * pool.length)];
    line = `${line} ${em}`;
  }

  return line;
}

// Cooldown tracker per (speaker, templateId)
class Cooldowns {
  private now = 0;
  private cd = 5000;
  private map = new Map<string, number>();
  constructor(cooldownMs?: number) {
    if (typeof cooldownMs === 'number') this.cd = Math.max(0, cooldownMs);
  }
  setTime(ms: number) {
    this.now = ms;
  }
  canUse(key: string) {
    const until = this.map.get(key) ?? 0;
    return this.now >= until;
  }
  touch(key: string) {
    this.map.set(key, this.now + this.cd);
  }
}

// Public API: BanterSystem
export class BanterSystem {
  private rng: () => number;
  private seed: number;
  private timeMs = 0;
  private cds: Cooldowns;
  private lastLineBySpeaker = new Map<string, string>();
  private lastSpeakerAt = new Map<string, number>();
  private sideMinGapMs = 0;

  constructor(opts: BanterOptions = {}) {
    this.seed = (opts.seed ?? 1337) >>> 0;
    this.rng = mulberry32(this.seed);
    this.cds = new Cooldowns(opts.cooldownMs ?? 5000);
    this.sideMinGapMs = Math.max(0, (opts.sideMinGapMs ?? 0) | 0);
  }

  // Advance internal time (ms). Use your game dt.
  step(dtMs: number) {
    this.timeMs += Math.max(0, dtMs | 0);
    this.cds.setTime(this.timeMs);
  }

  // Generate a line for `me` about the event, reacting to `them`.
  // Deterministic given same seed, call order, and inputs.
  speak(event: BanterEvent, me: Character, them: Character): SpeakResult | null {
    const rng = this.rng;
    const p = me.personality;
    const mergedLex = mergeLexicon(BASE_LEXICON, p.lexicon);

    // Per-speaker global gap
    const lastAt = this.lastSpeakerAt.get(me.id) ?? -Infinity;
    if (this.timeMs - lastAt < this.sideMinGapMs) return null;

    const trait = (name: keyof Omit<Personality, 'name' | 'quirks' | 'lexicon'>) =>
      Math.max(0, Math.min(1, (p as any)[name] as number));
    const pick = (lex: keyof Lexicon) => {
      const arr = mergedLex[lex];
      return arr[Math.floor(rng() * arr.length)] ?? '';
    };

    // Build candidate list respecting cooldown and last-line repeat avoidance
    const templates = TEMPLATES[event].slice();
    // Shuffle to vary among equal weights deterministically
    shuffleInPlace(rng, templates);

    type Candidate = {
      id: string;
      text: string;
      weight: number;
      mood: 'positive' | 'negative' | 'neutral';
    };
    const candidates: Candidate[] = [];

    const ctxBase: Omit<BuildCtx, 'pick'> & { pick: BuildCtx['pick'] } = {
      me: me.displayName ?? me.id,
      them: them.displayName ?? them.id,
      trait,
      pick,
      rng,
    };

    for (const t of templates) {
      const key = `${me.id}::${t.id}`;
      if (!this.cds.canUse(key)) continue;
      // Compute dynamic weight influenced by traits + baseWeight
      let w = t.baseWeight ?? 1;
      // Simple heuristics: aggression favors tauntHard templates, optimism favors praise/comeback
      if (t.id.startsWith('tt.')) w *= 0.6 + trait('aggression') * 0.9;
      if (t.id.startsWith('cb.')) w *= 0.6 + trait('optimism') * 0.9;
      if (t.id.startsWith('nd.')) w *= 0.9 + (1 - trait('optimism')) * 0.6;

      // Build line
      const raw = t.build(ctxBase);
      if (!raw) continue;

      // Immediate repeat guard
      if (this.lastLineBySpeaker.get(me.id) === raw) continue;

      // Mood inference for emoji/quirks
      const mood: Candidate['mood'] = inferMood(event, raw, trait);

      candidates.push({ id: t.id, text: raw, weight: w, mood });
    }

    // Fallback if all on cooldown or filtered
    if (candidates.length === 0) {
      const fallback = fallbackLine(event, ctxBase);
      if (!fallback) return null;
      const styled = styleLine(rng, fallback, p, inferMood(event, fallback, trait), mergedLex);
      this.lastLineBySpeaker.set(me.id, styled);
      return { speaker: me.id, text: styled, event };
    }

    const choice = pickWeighted(
      rng,
      candidates.map((c) => ({ item: c, w: c.weight })),
    );

    // Style with quirks and punctuation based on traits
    let line = styleLine(rng, choice.text, p, choice.mood, mergedLex);

    this.cds.touch(`${me.id}::${choice.id}`);
    this.lastLineBySpeaker.set(me.id, line);
    this.lastSpeakerAt.set(me.id, this.timeMs);
    return { speaker: me.id, text: line, event };
  }
}

function inferMood(
  event: BanterEvent,
  raw: string,
  trait: (name: keyof Omit<Personality, 'name' | 'quirks' | 'lexicon'>) => number,
): 'positive' | 'negative' | 'neutral' {
  if (event === 'victory' || event === 'first_blood' || event === 'comeback') return 'positive';
  if (event === 'near_death' || event === 'stagger' || event === 'big_hit') return 'negative';
  if (event === 'shields_down' || event === 'armor_break' || event === 'debuffed') return 'negative';
  if (event === 'shields_up' || event === 'repair') return 'positive';
  // Taunt mood depends on aggression
  if (event === 'taunt') return trait('aggression') > 0.55 ? 'negative' : 'neutral';
  // Default
  return /nice|clean|good|respect|gg/i.test(raw) ? 'positive' : 'neutral';
}

function styleLine(
  rng: () => number,
  line: string,
  p: Personality,
  mood: 'positive' | 'negative' | 'neutral',
  lex: Lexicon,
): string {
  // Formality: expand contractions or reduce punctuation
  if (p.formality > 0.7) {
    line = line
      .replace(/\bLet's\b/gi, 'Let us')
      .replace(/\bI'm\b/gi, 'I am')
      .replace(/\bYou're\b/gi, 'You are');
  }

  // Aggression and optimism adjust punctuation
  const exclamProb = 0.2 + 0.7 * p.aggression;
  const periodProb = 0.4 + 0.4 * p.formality;

  if (!/[.!?]$/.test(line)) {
    const r = rng();
    if (r < exclamProb) line += '!';
    else if (r < exclamProb + periodProb) line += '.';
  }

  // Humor and sarcasm: sometimes add a tag
  const tagProb = 0.15 * (p.humor + p.sarcasm);
  if (rng() < tagProb) {
    const tag = p.sarcasm > p.humor ? 'Sure.' : 'Heh.';
    line = `${line} ${tag}`;
  }

  // Apply stylistic quirks and emoji
  line = applyQuirks(rng, line, p, mood, lex);
  return line;
}

function fallbackLine(event: BanterEvent, ctx: BuildCtx): string | null {
  switch (event) {
    case 'match_start':
      return ctx.pick('greet');
    case 'victory':
      return 'GG.';
    case 'taunt':
      return ctx.pick('tauntSoft');
    case 'first_blood':
    case 'big_hit':
      return ctx.pick('hype');
    case 'stagger':
      return 'Ow.';
    case 'comeback':
      return ctx.pick('comeback');
    case 'near_death':
      return ctx.pick('nearDeath');
    case 'shields_down':
      return 'Shields down.';
    case 'armor_break':
      return 'Lost a plate.';
    case 'shields_up':
      return 'Shield online.';
    case 'repair':
      return 'Patched up.';
    case 'debuffed':
      return 'Systems slugged.';
    default:
      return null;
  }
}

// Convenience factory for easy API consumption
export function createCharacter(
  id: string,
  personality: Personality,
  displayName?: string,
): Character {
  const c: Character = { id, personality } as Character;
  if (displayName !== undefined) (c as any).displayName = displayName;
  return c;
}
