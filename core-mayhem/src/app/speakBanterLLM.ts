import { ollamaChat } from '../banter/llm/ollama';
import { setBanter } from '../render/banter';
import { sim } from '../state';
import { readLLMSettings, readBanterPacing } from '../ui/banterControls';

import type { BanterEvent } from '../banter';

type SideLR = 'L' | 'R';

const inflight: Record<SideLR, boolean> = { L: false, R: false };

// Debug guard for optional prompt logging
const DBG_KEY = 'cm_banterDebug';
function banterDebugEnabled(): boolean {
  try {
    const v = (sim as any)?.banterDebug;
    if (typeof v === 'boolean') return v;
    const ls = localStorage.getItem(DBG_KEY);
    return ls === '1' || ls === 'true';
  } catch {
    return false;
  }
}
function dbg(...args: any[]): void {
  if (banterDebugEnabled()) console.warn(...args);
}

function eventAllowed(ev: BanterEvent, mask: string): boolean {
  if (!mask || mask === '*') return true;
  const set = new Set(
    mask
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return set.has(ev);
}

function buildPersonaFromTraits(me: any, emojiStyle: string, opp?: any): string {
  const p = (me?.personality ?? {}) as any;
  const name = String(me?.displayName ?? me?.id ?? 'Core');
  const style =
    emojiStyle && emojiStyle !== 'inherit' ? ` Preferred emoji style: ${emojiStyle}.` : '';
  const blurb = p?.blurb ? String(p.blurb) + ' ' : '';
  const oppName = String(opp?.displayName ?? opp?.id ?? 'Opponent');
  const oppBlurb = String(opp?.blurb ?? opp?.id ?? '');
  return (
    `${blurb}You are ${name}, a duelist performing in a live arena. You are NOT an AI.` +
    `Your purpose is to entertain viewers and stir up drama while fighting ${oppName}. ` +
    `Speak naturally and punchy (one short line). ` +
    `Traits — aggression:${p.aggression ?? 0}, humor:${p.humor ?? 0}, formality:${p.formality ?? 0}, optimism:${p.optimism ?? 0}, sarcasm:${p.sarcasm ?? 0}. ` +
    `Opponent profile — name:${oppName}, bio:${oppBlurb}. ` +
    `${style} Aim for spicy, witty taunts with a bit of bite; vary structure and word choice; use contractions and occasional rhetorical flourish; keep it PG-13; never break character; avoid profanity; avoid terms of endearment, pet names, or familiar names. ` +
    `Address the opponent only by their display name or "you". Avoid flirting, romance, or innuendo.`
  );
}

function styleHintFor(ev: BanterEvent, ctx: { meHP: number; themHP: number }): string {
  const dhp = Number(ctx.meHP) - Number(ctx.themHP);
  const lead = dhp > 20 ? 'winning' : dhp < -20 ? 'losing' : 'close';
  const tone =
    lead === 'winning'
      ? 'cocky, confident'
      : lead === 'losing'
        ? 'gritty, defiant'
        : 'tense, sharp';
  const byEvent: Record<BanterEvent, string> = {
    match_start: `bold opener; playful jab; set rivalry; ${tone}`,
    first_blood: `capitalize momentum; quick taunt; ${tone}`,
    big_hit: `react with impact; escalate heat; ${tone}`,
    stagger: `smell blood; pressure with ruthless quip; ${tone}`,
    comeback: `triumphant, against-the-odds energy; ${tone}`,
    near_death: `desperate or fearless; short and cutting; ${tone}`,
    victory: `boastful finisher; signature flair; ${tone}`,
    taunt: `spicy, witty, targeted jab; ${tone}`,
    shields_down: `gritty resilience; acknowledge collapse without panic; ${tone}`,
    armor_break: `pained but defiant; terse; ${tone}`,
    shields_up: `confident, re-fortified; quick flex; ${tone}`,
    repair: `composed, regained footing; short; ${tone}`,
    debuffed: `irritated, defiant; minimize impact; ${tone}`,
  } as const;
  return byEvent[ev] ?? tone;
}

function composeUserPrompt(
  ev: BanterEvent,
  ctx: { meHP: number; themHP: number; lastOpp?: string },
): string {
  const parts: string[] = [];
  parts.push(`Event: ${ev}`);
  parts.push(`YouHP: ${ctx.meHP}`);
  parts.push(`OppHP: ${ctx.themHP}`);
  if (ctx.lastOpp) parts.push(`Opponent said: ${ctx.lastOpp}`);
  parts.push('Audience: Live viewers—make it entertaining.');
  parts.push(`Style: ${styleHintFor(ev, ctx)}`);
  parts.push('Respond in one concise line (natural speech).');
  return parts.join('\n');
}

function firstLineAndTrim(s: string, maxChars: number): string {
  let t = (s || '').replace(/\r/g, '').split('\n')[0] ?? '';
  t = t.trim();
  if (t.length > maxChars) t = t.slice(0, maxChars).trim();
  return t;
}

function stripEmojiIfNeeded(text: string, mode: 'inherit' | 'none' | 'emoji' | 'kaomoji'): string {
  if (mode !== 'none') return text;
  // Remove a wide range of emoji pictographs and symbols
  try {
    return text
      .replace(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } catch {
    return text;
  }
}

function profanityFilter(text: string, level: 'off' | 'mild' | 'strict'): string {
  if (level === 'off') return text;
  const mild = ['damn', 'hell', 'crap'];
  const strict = mild.concat(['shit', 'fuck', 'bitch', 'bastard']);
  const list = level === 'strict' ? strict : mild;
  let out = text;
  for (const w of list) {
    const re = new RegExp(`\\b${w}\\b`, 'gi');
    out = out.replace(re, '*'.repeat(Math.max(3, w.length)));
  }
  return out;
}

// Replace terms of endearment with a neutral address
function stripEndearments(text: string): string {
  const words = [
    'darling',
    'honey',
    'sweetie',
    'babe',
    'baby',
    'dear',
    'luv',
    'love',
    'cutie',
    'angel',
    'sweetheart',
    'princess',
    'handsome',
    'sugar',
    'pumpkin',
    'beautiful',
    'gorgeous',
  ];
  let out = text;
  for (const w of words) {
    const re = new RegExp(`(^|[^A-Za-z])(${w})($|[^A-Za-z])`, 'gi');
    out = out.replace(re, (_m, pre, _w, post) => `${pre}you${post}`);
  }
  return out;
}

export async function speakBanterSmart(ev: BanterEvent, side: SideLR): Promise<void> {
  const b: any = (sim as any).banter;
  const L: any = (sim as any).banterL;
  const R: any = (sim as any).banterR;
  if (!b || !L || !R) return;
  if ((sim as any).banterEnabled === false) return;

  const me = side === 'L' ? L : R;
  const them = side === 'L' ? R : L;

  // Read UI settings
  const cfgAll = (() => {
    try {
      return readLLMSettings();
    } catch {
      return { enabled: true, settings: null as any };
    }
  })();
  if (!cfgAll.enabled) return;
  const st = cfgAll.settings as ReturnType<typeof readLLMSettings>['settings'];

  // If event not allowed, fallback immediately
  if (!eventAllowed(ev, st.events)) {
    try {
      const out = b.speak(ev, me, them);
      if (out) setBanter(side, stripEndearments(out.text));
    } catch {
      /* ignore */
    }
    return;
  }

  // Provider branch
  if (st.provider !== 'ollama' || !st.model || !st.ollamaUrl) {
    try {
      const out = b.speak(ev, me, them);
      if (out) setBanter(side, stripEndearments(out.text));
    } catch {
      /* ignore */
    }
    return;
  }

  // Per-side generation counter to drop stale async completions
  const seq = (((sim as any).banterSeq ??= { L: 0, R: 0 }) as Record<SideLR, number>);
  // Bump generation for every call so later calls supersede earlier ones
  const myGen = ++seq[side];

  // Local pacing guard for LLM path and fallback alike
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const gate = (((sim as any).banterGate ??= { L: 0, R: 0, lastAny: 0 }) as any);
  const pacing = (() => {
    try {
      return readBanterPacing();
    } catch {
      return { cooldownMs: 5000, sideMinGapMs: 12000 };
    }
  })();
  const sideTooSoon = now - (gate[side] ?? 0) < Math.max(0, pacing.sideMinGapMs | 0);
  const crossMin = Math.max(800, Math.min(3500, Math.round(((pacing.sideMinGapMs ?? 2000)) * 0.4)));
  const anyTooSoon = now - (gate.lastAny ?? 0) < crossMin;
  if (sideTooSoon || anyTooSoon) {
    // Too soon to speak; invalidate older inflight by bumping gen, but do nothing else
    return;
  }

  if (inflight[side]) {
    // Already querying; avoid piling up. Fallback to deterministic.
    try {
      const out = b.speak(ev, me, them);
      if (out) {
        setBanter(side, stripEndearments(out.text));
        gate[side] = now;
        gate.lastAny = now;
      }
    } catch {
      /* ignore */
    }
    return;
  }

  inflight[side] = true;
  try {
    const meHP =
      side === 'L'
        ? Number((sim as any).coreL?.centerHP | 0)
        : Number((sim as any).coreR?.centerHP | 0);
    const themHP =
      side === 'L'
        ? Number((sim as any).coreR?.centerHP | 0)
        : Number((sim as any).coreL?.centerHP | 0);
    const ui = (sim as any).banterUI;
    const lastOpp = st.includeOpponentLast ? (side === 'L' ? ui?.R?.text : ui?.L?.text) : '';
    const system = buildPersonaFromTraits(me, st.emojiStyle, them);
    const prompt = composeUserPrompt(ev, { meHP, themHP, lastOpp: lastOpp ?? '' });

    // Optional debug logging of final prompts
    dbg('[banter][LLM] system:', system);
    dbg('[banter][LLM] user:', prompt);

    const resp = await ollamaChat(
      st.ollamaUrl,
      st.model,
      system,
      prompt,
      { temperature: st.temperature, top_p: st.topP, repeat_penalty: st.repeatPenalty },
      st.timeoutMs,
    );

    let outText: string | null = null;
    if (typeof resp === 'string' && resp.trim()) {
      outText = firstLineAndTrim(resp, st.maxChars);
      outText = stripEmojiIfNeeded(outText, st.emojiStyle as any);
      outText = profanityFilter(outText, st.profanityFilter as any);
      outText = stripEndearments(outText);
      // Ensure terminal punctuation for consistency
      if (outText && !/[.!?]$/.test(outText)) outText += '.';
    }

    if (outText) {
      // Only apply if this completion is still the latest for this side
      if ((((sim as any).banterSeq as Record<SideLR, number>)[side] | 0) === myGen) {
        setBanter(side, outText);
        gate[side] = typeof performance !== 'undefined' ? performance.now() : Date.now();
        gate.lastAny = gate[side];
      }
      return;
    }

    // Fallback
    try {
      const out = b.speak(ev, me, them);
      if (out) {
        setBanter(side, stripEndearments(out.text));
        gate[side] = typeof performance !== 'undefined' ? performance.now() : Date.now();
        gate.lastAny = gate[side];
      }
    } catch {
      /* ignore */
    }
  } catch {
    try {
      const out = b.speak(ev, me, them);
      if (out) {
        setBanter(side, stripEndearments(out.text));
        const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
        gate[side] = t;
        gate.lastAny = t;
      }
    } catch {
      /* ignore */
    }
  } finally {
    inflight[side] = false;
  }
}
