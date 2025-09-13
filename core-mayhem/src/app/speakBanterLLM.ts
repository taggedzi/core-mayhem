import { setBanter } from '../render/banter';
import type { BanterEvent } from '../banter';
import { ollamaChat } from '../banter/llm/ollama';
import { sim } from '../state';
import { readLLMSettings, readBanterPacing } from '../ui/banterControls';

type SideLR = 'L' | 'R';

const inflight: Record<SideLR, boolean> = { L: false, R: false };

function eventAllowed(ev: BanterEvent, mask: string): boolean {
  if (!mask || mask === '*') return true;
  const set = new Set(mask.split(',').map((s) => s.trim()).filter(Boolean));
  return set.has(ev);
}

function buildPersonaFromTraits(me: any, emojiStyle: string): string {
  const p = (me?.personality ?? {}) as any;
  const name = String(me?.displayName ?? me?.id ?? 'Core');
  const style = emojiStyle && emojiStyle !== 'inherit' ? ` Preferred emoji style: ${emojiStyle}.` : '';
  const blurb = (p?.blurb ? String(p.blurb) + ' ' : '');
  return (
    `${blurb}You are ${name}, a duelist AI. Speak concisely (one short line). ` +
    `Traits — aggression:${p.aggression ?? 0}, humor:${p.humor ?? 0}, formality:${p.formality ?? 0}, optimism:${p.optimism ?? 0}, sarcasm:${p.sarcasm ?? 0}.` +
    `${style} Avoid profanity. Stay in character.`
  );
}

function composeUserPrompt(ev: BanterEvent, ctx: { meHP: number; themHP: number; lastOpp?: string }): string {
  const parts: string[] = [];
  parts.push(`Event: ${ev}`);
  parts.push(`YouHP: ${ctx.meHP}`);
  parts.push(`OppHP: ${ctx.themHP}`);
  if (ctx.lastOpp) parts.push(`Opponent said: ${ctx.lastOpp}`);
  parts.push('Respond in one concise line.');
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
    return text.replace(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/gu, '').replace(/\s{2,}/g, ' ').trim();
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

export async function speakBanterSmart(ev: BanterEvent, side: SideLR): Promise<void> {
  const b: any = (sim as any).banter;
  const L: any = (sim as any).banterL;
  const R: any = (sim as any).banterR;
  if (!b || !L || !R) return;
  if ((sim as any).banterEnabled === false) return;

  const me = side === 'L' ? L : R;
  const them = side === 'L' ? R : L;

  // Read UI settings
  const cfgAll = (() => { try { return readLLMSettings(); } catch { return { enabled: true, settings: null as any }; } })();
  if (!cfgAll.enabled) return;
  const st = cfgAll.settings as ReturnType<typeof readLLMSettings>['settings'];

  // If event not allowed, fallback immediately
  if (!eventAllowed(ev, st.events)) {
    try { const out = b.speak(ev, me, them); if (out) setBanter(side, out.text); } catch { /* ignore */ }
    return;
  }

  // Provider branch
  if (st.provider !== 'ollama' || !st.model || !st.ollamaUrl) {
    try { const out = b.speak(ev, me, them); if (out) setBanter(side, out.text); } catch { /* ignore */ }
    return;
  }

  // Per-side generation counter to drop stale async completions
  const seq = (((sim as any).banterSeq ||= { L: 0, R: 0 }) as Record<SideLR, number>);
  // Bump generation for every call so later calls supersede earlier ones
  const myGen = ++seq[side];

  // Local pacing guard for LLM path and fallback alike
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const gate = (((sim as any).banterGate ||= { L: 0, R: 0, lastAny: 0 }) as any);
  const pacing = (() => { try { return readBanterPacing(); } catch { return { cooldownMs: 5000, sideMinGapMs: 12000 }; } })();
  const sideTooSoon = (now - (gate[side] || 0)) < Math.max(0, pacing.sideMinGapMs | 0);
  const crossMin = Math.max(800, Math.min(3500, Math.round((pacing.sideMinGapMs || 2000) * 0.4)));
  const anyTooSoon = (now - (gate.lastAny || 0)) < crossMin;
  if (sideTooSoon || anyTooSoon) {
    // Too soon to speak; invalidate older inflight by bumping gen, but do nothing else
    return;
  }

  if (inflight[side]) {
    // Already querying; avoid piling up. Fallback to deterministic.
    try {
      const out = b.speak(ev, me, them);
      if (out) { setBanter(side, out.text); gate[side] = now; gate.lastAny = now; }
    } catch { /* ignore */ }
    return;
  }

  inflight[side] = true;
  try {
    const meHP = side === 'L' ? Number((sim as any).coreL?.centerHP | 0) : Number((sim as any).coreR?.centerHP | 0);
    const themHP = side === 'L' ? Number((sim as any).coreR?.centerHP | 0) : Number((sim as any).coreL?.centerHP | 0);
    const ui = (sim as any).banterUI;
    const lastOpp = st.includeOpponentLast ? (side === 'L' ? ui?.R?.text : ui?.L?.text) : '';
    const system = buildPersonaFromTraits(me, st.emojiStyle);
    const prompt = composeUserPrompt(ev, { meHP, themHP, lastOpp: lastOpp || '' });

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
      // Ensure terminal punctuation for consistency
      if (outText && !/[.!?]$/.test(outText)) outText += '.';
    }

    if (outText) {
      // Only apply if this completion is still the latest for this side
      if ((((sim as any).banterSeq as Record<SideLR, number>)[side] | 0) === myGen) {
        setBanter(side, outText);
        gate[side] = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        gate.lastAny = gate[side];
      }
      return;
    }

    // Fallback
    try {
      const out = b.speak(ev, me, them);
      if (out) { setBanter(side, out.text); gate[side] = (typeof performance !== 'undefined' ? performance.now() : Date.now()); gate.lastAny = gate[side]; }
    } catch { /* ignore */ }
  } catch {
    try {
      const out = b.speak(ev, me, them);
      if (out) { setBanter(side, out.text); const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()); gate[side] = t; gate.lastAny = t; }
    } catch { /* ignore */ }
  } finally {
    inflight[side] = false;
  }
}
