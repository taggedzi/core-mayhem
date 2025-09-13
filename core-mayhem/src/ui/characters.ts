import { PERSONA_CATALOG } from '../banter/personas';
import type { Personality } from '../banter';

type SideLR = 'L' | 'R';

const K = {
  L: 'cm_char_L',
  R: 'cm_char_R',
} as const;

type StoredProfile = {
  persona: keyof typeof PERSONA_CATALOG;
  overrides?: Partial<Personality> & { quirks?: Partial<NonNullable<Personality['quirks']>> };
};

function loadProfile(side: SideLR): StoredProfile | null {
  try { const raw = localStorage.getItem(K[side]); if (!raw) return null; return JSON.parse(raw) as StoredProfile; } catch { return null; }
}
function saveProfile(side: SideLR, prof: StoredProfile): void {
  try { localStorage.setItem(K[side], JSON.stringify(prof)); } catch { /* ignore */ }
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

function applyOverrides(base: Personality, ov?: StoredProfile['overrides']): Personality {
  if (!ov) return base;
  const p: Personality = { ...base } as any;
  for (const k of ['aggression','humor','formality','optimism','sarcasm'] as const) {
    if (ov[k] != null) (p as any)[k] = clamp01(Number(ov[k]));
  }
  if (ov.blurb != null) (p as any).blurb = String(ov.blurb);
  const bq = base.quirks ?? { ellipsis: 0, staccato: 0, randomCaps: 0, emojiStyle: 'none', emoji: 0 };
  const oq = ov.quirks ?? {};
  p.quirks = {
    ellipsis: oq.ellipsis != null ? clamp01(Number(oq.ellipsis)) : bq.ellipsis,
    staccato: oq.staccato != null ? clamp01(Number(oq.staccato)) : bq.staccato,
    randomCaps: oq.randomCaps != null ? clamp01(Number(oq.randomCaps)) : bq.randomCaps,
    emojiStyle: (oq.emojiStyle ?? bq.emojiStyle) as any,
    emoji: oq.emoji != null ? clamp01(Number(oq.emoji)) : bq.emoji,
  } as any;
  return p;
}

function personaOptions(): { value: string; label: string }[] {
  return Object.keys(PERSONA_CATALOG).map((k) => ({ value: k, label: k.replace(/Core$/,'') }));
}

export function initCharactersControls(): void {
  const btn = document.getElementById('btnChars') as HTMLButtonElement | null;
  if (!btn) return;

  const pop = document.createElement('div');
  pop.id = 'charsPopover';
  pop.className = 'audio-popover';
  pop.style.display = 'none';

  const section = (title: string): HTMLDivElement => {
    const d = document.createElement('div'); d.className = 'audio-row';
    const s = document.createElement('strong'); s.textContent = title; d.appendChild(s); return d;
  };
  const selectRow = (label: string, id: string, options: { value: string; label: string }[], def: string): HTMLSelectElement => {
    const wrap = document.createElement('label'); wrap.className = 'audio-row'; wrap.textContent = label + ' ';
    const sel = document.createElement('select'); sel.id = id;
    for (const o of options) { const opt = document.createElement('option'); opt.value = o.value; opt.text = o.label; if (o.value === def) opt.selected = true; sel.appendChild(opt); }
    wrap.appendChild(sel); pop.appendChild(wrap); return sel;
  };
  const slider = (label: string, id: string, def: number): HTMLInputElement => {
    const wrap = document.createElement('label'); wrap.className = 'audio-row'; wrap.textContent = label + ' ';
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.05'; inp.value = String(def); inp.id = id;
    wrap.appendChild(inp); pop.appendChild(wrap); return inp;
  };
  const selectEmoji = (label: string, id: string, def: string): HTMLSelectElement => {
    const wrap = document.createElement('label'); wrap.className = 'audio-row'; wrap.textContent = label + ' ';
    const sel = document.createElement('select'); sel.id = id;
    for (const v of ['none','emoji','kaomoji']) { const opt = document.createElement('option'); opt.value = v; opt.text = v; if (v===def) opt.selected = true; sel.appendChild(opt); }
    wrap.appendChild(sel); pop.appendChild(wrap); return sel;
  };
  const btnRow = (): HTMLDivElement => { const d = document.createElement('div'); d.className = 'audio-row buttons'; pop.appendChild(d); return d; };

  const makeSide = (side: SideLR, title: string) => {
    pop.appendChild(section(title));
    const stored = loadProfile(side) ?? { persona: 'LightCore' } as StoredProfile;
    const base = PERSONA_CATALOG[stored.persona] ?? PERSONA_CATALOG.LightCore;
    const cur = applyOverrides(base, stored.overrides);

    const selPersona = selectRow('Persona', `${side}_persona`, personaOptions(), stored.persona);
    const sAgg = slider('Aggression', `${side}_aggr`, cur.aggression);
    const sHum = slider('Humor', `${side}_hum`, cur.humor);
    const sFor = slider('Formality', `${side}_for`, cur.formality);
    const sOpt = slider('Optimism', `${side}_opt`, cur.optimism);
    const sSar = slider('Sarcasm', `${side}_sar`, cur.sarcasm);
    const sEll = slider('Quirk: Ellipsis', `${side}_ell`, cur.quirks?.ellipsis ?? 0);
    const sStc = slider('Quirk: Staccato', `${side}_stc`, cur.quirks?.staccato ?? 0);
    const sCap = slider('Quirk: RandomCaps', `${side}_cap`, cur.quirks?.randomCaps ?? 0);
    const sEmj = slider('Quirk: Emoji Chance', `${side}_emj`, cur.quirks?.emoji ?? 0);
    const selEmStyle = selectEmoji('Quirk: Emoji Style', `${side}_emjs`, String(cur.quirks?.emojiStyle ?? 'none'));

    const buttons = btnRow();
    const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.textContent = 'Save';
    const btnReset = document.createElement('button'); btnReset.type = 'button'; btnReset.textContent = 'Reset Persona';
    buttons.append(btnSave, btnReset);

    const currentProfile = (): StoredProfile => {
      const persona = (selPersona.value as keyof typeof PERSONA_CATALOG) || 'LightCore';
      const o: StoredProfile['overrides'] = {
        aggression: Number(sAgg.value), humor: Number(sHum.value), formality: Number(sFor.value), optimism: Number(sOpt.value), sarcasm: Number(sSar.value),
        quirks: { ellipsis: Number(sEll.value), staccato: Number(sStc.value), randomCaps: Number(sCap.value), emoji: Number(sEmj.value), emojiStyle: selEmStyle.value as any },
      };
      return { persona, overrides: o };
    };

    btnSave.addEventListener('click', (e) => { e.preventDefault(); saveProfile(side, currentProfile()); });
    btnReset.addEventListener('click', (e) => {
      e.preventDefault();
      const persona = (selPersona.value as keyof typeof PERSONA_CATALOG) || 'LightCore';
      const p = PERSONA_CATALOG[persona];
      sAgg.value = String(p.aggression);
      sHum.value = String(p.humor);
      sFor.value = String(p.formality);
      sOpt.value = String(p.optimism);
      sSar.value = String(p.sarcasm);
      sEll.value = String(p.quirks?.ellipsis ?? 0);
      sStc.value = String(p.quirks?.staccato ?? 0);
      sCap.value = String(p.quirks?.randomCaps ?? 0);
      sEmj.value = String(p.quirks?.emoji ?? 0);
      selEmStyle.value = String(p.quirks?.emojiStyle ?? 'none');
      saveProfile(side, { persona });
    });

    selPersona.addEventListener('change', () => {
      const p = PERSONA_CATALOG[selPersona.value as keyof typeof PERSONA_CATALOG] ?? PERSONA_CATALOG.LightCore;
      sAgg.value = String(p.aggression);
      sHum.value = String(p.humor);
      sFor.value = String(p.formality);
      sOpt.value = String(p.optimism);
      sSar.value = String(p.sarcasm);
      sEll.value = String(p.quirks?.ellipsis ?? 0);
      sStc.value = String(p.quirks?.staccato ?? 0);
      sCap.value = String(p.quirks?.randomCaps ?? 0);
      sEmj.value = String(p.quirks?.emoji ?? 0);
      selEmStyle.value = String(p.quirks?.emojiStyle ?? 'none');
      saveProfile(side, { persona: selPersona.value as any });
    });
  };

  makeSide('L', 'Left Character');
  makeSide('R', 'Right Character');

  document.body.appendChild(pop);

  // Popover positioning/behavior
  const positionPopover = (): void => {
    const r = btn.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.left = `${Math.round(r.right - pop.offsetWidth)}px`;
    pop.style.top = `${Math.round(r.bottom + 6)}px`;
  };
  let open = false;
  const close = (): void => { open = false; pop.style.display = 'none'; window.removeEventListener('resize', positionPopover); document.removeEventListener('click', onDocClick, true); };
  const onDocClick = (e: MouseEvent): void => { if (!open) return; const t = e.target as Node | null; if (t && (t === pop || pop.contains(t) || t === btn)) return; close(); };
  const toggle = (): void => { open = !open; if (open) { pop.style.display = 'block'; positionPopover(); window.addEventListener('resize', positionPopover); document.addEventListener('click', onDocClick, true); } else close(); };
  btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
}

export function readCharacterProfiles(): { left: Personality; right: Personality; leftName: string; rightName: string } {
  const pL = loadProfile('L'); const pR = loadProfile('R');
  const baseL = pL?.persona ? PERSONA_CATALOG[pL.persona] : PERSONA_CATALOG.LightCore;
  const baseR = pR?.persona ? PERSONA_CATALOG[pR.persona] : PERSONA_CATALOG.DarkCore;
  const left = applyOverrides(baseL, pL?.overrides);
  const right = applyOverrides(baseR, pR?.overrides);
  return { left, right, leftName: baseL.name.replace(/Core$/,'') || 'Left', rightName: baseR.name.replace(/Core$/,'') || 'Right' };
}
