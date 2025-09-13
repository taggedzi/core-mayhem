import { sim } from '../state';
import { DEFAULT_LLM, type LLMSettings } from '../config/llm';

const K = {
  on: 'cm_banterEnabled',
  src: 'cm_banterSource',
  url: 'cm_ollamaUrl',
  model: 'cm_ollamaModel',
  to: 'cm_banterTimeoutMs',
  chars: 'cm_banterMaxChars',
  temp: 'cm_banterTemp',
  topp: 'cm_banterTopP',
  rep: 'cm_banterRepeatPenalty',
  incl: 'cm_banterIncludeOpponent',
  emoji: 'cm_banterEmojiStyle',
  prof: 'cm_banterProfanity',
  cd: 'cm_banterCooldownMs',
  gap: 'cm_banterSideGapMs',
  ev: 'cm_banterEventMask',
} as const;

function loadBool(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v === '1'; } catch { return fallback; }
}
function loadNum(key: string, fallback: number): number {
  try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) ? v : fallback; } catch { return fallback; }
}
function loadStr(key: string, fallback: string): string {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
function save(key: string, v: string | number | boolean): void {
  try { localStorage.setItem(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v)); } catch { /* ignore */ }
}

function getInitial(): LLMSettings {
  return {
    provider: (loadStr(K.src, DEFAULT_LLM.provider) as any),
    ollamaUrl: loadStr(K.url, DEFAULT_LLM.ollamaUrl),
    model: loadStr(K.model, DEFAULT_LLM.model),
    timeoutMs: loadNum(K.to, DEFAULT_LLM.timeoutMs),
    maxChars: loadNum(K.chars, DEFAULT_LLM.maxChars),
    temperature: Number(loadNum(K.temp, DEFAULT_LLM.temperature).toFixed(2)),
    topP: Number(loadNum(K.topp, DEFAULT_LLM.topP).toFixed(2)),
    repeatPenalty: Number(loadNum(K.rep, DEFAULT_LLM.repeatPenalty).toFixed(2)),
    includeOpponentLast: loadBool(K.incl, DEFAULT_LLM.includeOpponentLast),
    emojiStyle: (loadStr(K.emoji, DEFAULT_LLM.emojiStyle) as any),
    profanityFilter: (loadStr(K.prof, DEFAULT_LLM.profanityFilter) as any),
    cooldownMs: loadNum(K.cd, DEFAULT_LLM.cooldownMs),
    sideMinGapMs: loadNum(K.gap, DEFAULT_LLM.sideMinGapMs),
    events: loadStr(K.ev, DEFAULT_LLM.events),
  };
}

// Exported reader for other modules to consume current LLM settings and enabled flag
export function readLLMSettings(): { enabled: boolean; settings: LLMSettings } {
  const settings = getInitial();
  const enabled = loadBool(K.on, true);
  return { enabled, settings };
}

async function listOllamaModels(base: string, timeoutMs = 1500): Promise<string[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(300, timeoutMs));
  try {
    const url = base.replace(/\/$/, '') + '/api/tags';
    const r = await fetch(url, { method: 'GET', signal: ctrl.signal });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json().catch(() => ({} as any));
    const arr = Array.isArray((data as any).models) ? (data as any).models : [];
    const names = arr.map((m: any) => String(m?.model ?? m?.name ?? '')).filter(Boolean);
    return names;
  } finally { clearTimeout(t); }
}

async function testOllamaChat(base: string, model: string, timeoutMs = 1200): Promise<boolean> {
  if (!base || !model) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(300, timeoutMs));
  try {
    const url = base.replace(/\/$/, '') + '/api/chat';
    const body = {
      model,
      messages: [
        { role: 'system', content: 'You are a concise test responder. Answer with a single short word.' },
        { role: 'user', content: 'ping' },
      ],
      stream: false,
      options: { temperature: 0.1, top_p: 0.9, repeat_penalty: 1.1 },
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return false;
    const data = await r.json().catch(() => ({} as any));
    const msg = (data as any)?.message?.content ?? (data as any)?.choices?.[0]?.message?.content ?? '';
    return typeof msg === 'string' && msg.length > 0;
  } catch {
    return false;
  } finally { clearTimeout(t); }
}

export function initBanterControls(): void {
  const btn = document.getElementById('btnBanter') as HTMLButtonElement | null;
  if (!btn) return;

  const pop = document.createElement('div');
  pop.id = 'banterPopover';
  // Reuse audio popover styling for visual consistency
  pop.className = 'audio-popover';
  pop.style.display = 'none';

  const headerRow = (label: string): HTMLDivElement => {
    const wrap = document.createElement('div');
    wrap.className = 'audio-row';
    const strong = document.createElement('strong');
    strong.textContent = label;
    wrap.appendChild(strong);
    return wrap;
  };

  const checkbox = (label: string, id: string, def: boolean): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'checkbox'; inp.id = id; inp.checked = def;
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp;
  };

  const numberRow = (label: string, id: string, def: number, opts?: { min?: number; max?: number; step?: number }): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.id = id; inp.value = String(def);
    if (opts?.min != null) inp.min = String(opts.min);
    if (opts?.max != null) inp.max = String(opts.max);
    if (opts?.step != null) inp.step = String(opts.step);
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp as HTMLInputElement;
  };

  const rangeRow = (label: string, id: string, def: number, opts: { min: number; max: number; step?: number }): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.id = id; inp.value = String(def);
    inp.min = String(opts.min); inp.max = String(opts.max);
    if (opts.step != null) inp.step = String(opts.step);
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp as HTMLInputElement;
  };

  const textRow = (label: string, id: string, def: string, placeholder?: string): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.id = id; inp.value = def; if (placeholder) inp.placeholder = placeholder;
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp as HTMLInputElement;
  };

  const selectRow = (label: string, id: string, options: { value: string; label: string }[], def: string): HTMLSelectElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const sel = document.createElement('select');
    sel.id = id;
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value; opt.text = o.label;
      if (o.value === def) opt.selected = true;
      sel.appendChild(opt);
    }
    wrap.appendChild(sel);
    pop.appendChild(wrap);
    return sel;
  };

  // Current state
  const enabled0 = loadBool(K.on, true);
  (sim as any).banterEnabled = enabled0;

  const st = getInitial();

  pop.appendChild(headerRow('Banter'));
  const elOn = checkbox('Enabled', 'banterEnabled', enabled0);

  const elProvider = selectRow('Source', 'banterSource', [
    { value: 'deterministic', label: 'Deterministic' },
    { value: 'ollama', label: 'Ollama' },
  ], st.provider);

  // Ollama-specific
  const elUrl = textRow('Ollama URL', 'ollamaUrl', st.ollamaUrl, 'http://localhost:11434');
  const elModel = selectRow('Model', 'ollamaModel', [{ value: '', label: '(select model)' }], st.model || '');
  const btnWrap = document.createElement('div');
  btnWrap.className = 'audio-row buttons';
  const btnRefresh = document.createElement('button'); btnRefresh.type = 'button'; btnRefresh.textContent = 'Refresh Models';
  const btnTest = document.createElement('button'); btnTest.type = 'button'; btnTest.textContent = 'Test';
  const status = document.createElement('span'); status.style.marginLeft = '8px'; status.textContent = '';
  btnWrap.append(btnRefresh, btnTest, status);
  pop.appendChild(btnWrap);

  pop.appendChild(headerRow('Quality & Limits'));
  const elTimeout = numberRow('Timeout (ms)', 'banterTimeout', st.timeoutMs, { min: 500, max: 8000, step: 100 });
  const elChars = numberRow('Max Chars', 'banterMaxChars', st.maxChars, { min: 60, max: 240, step: 10 });
  const elTemp = rangeRow('Temperature', 'banterTemp', st.temperature, { min: 0, max: 1, step: 0.01 });
  const elTopP = rangeRow('Top-p', 'banterTopP', st.topP, { min: 0, max: 1, step: 0.01 });
  const elRep = rangeRow('Repeat Penalty', 'banterRepeat', st.repeatPenalty, { min: 1, max: 2, step: 0.05 });

  pop.appendChild(headerRow('Style & Context'));
  const elIncl = checkbox("Include opponent's last line", 'banterIncludeOpp', st.includeOpponentLast);
  const elEmoji = selectRow('Emoji Style', 'banterEmoji', [
    { value: 'inherit', label: 'Inherit character' },
    { value: 'none', label: 'None' },
    { value: 'emoji', label: 'Emoji' },
    { value: 'kaomoji', label: 'Kaomoji' },
  ], st.emojiStyle);
  const elProf = selectRow('Profanity Filter', 'banterProf', [
    { value: 'off', label: 'Off' },
    { value: 'mild', label: 'Mild' },
    { value: 'strict', label: 'Strict' },
  ], st.profanityFilter);

  pop.appendChild(headerRow('Pacing'));
  const elCd = numberRow('Cooldown (ms)', 'banterCooldown', st.cooldownMs, { min: 1000, max: 20000, step: 250 });
  const elGap = numberRow('Side Min Gap (ms)', 'banterGap', st.sideMinGapMs, { min: 2000, max: 30000, step: 500 });

  pop.appendChild(headerRow('Events'));
  const events = ['match_start','first_blood','big_hit','stagger','comeback','near_death','victory','taunt'];
  const mask0 = new Set(st.events === '*' ? events : st.events.split(',').map(s => s.trim()).filter(Boolean));
  const evChecks: Record<string, HTMLInputElement> = {};
  for (const ev of events) {
    const cb = checkbox(ev, 'ev_' + ev, mask0.has(ev));
    evChecks[ev] = cb;
  }

  document.body.appendChild(pop);

  // Initial provider UI state
  const applyProviderVisibility = (): void => {
    const showOllama = (elProvider.value === 'ollama');
    elUrl.parentElement!.style.display = showOllama ? '' : 'none';
    elModel.parentElement!.style.display = showOllama ? '' : 'none';
    btnWrap.style.display = showOllama ? '' : 'none';
  };
  applyProviderVisibility();

  // Attach listeners & persistence
  const refreshBtnLabel = (): void => {
    const on = (sim as any).banterEnabled !== false;
    if (btn) { btn.textContent = on ? '💬 Banter' : '💬 Banter'; btn.style.opacity = on ? '1' : '0.55'; }
  };
  refreshBtnLabel();

  elOn.addEventListener('change', () => {
    const on = !!(elOn as HTMLInputElement).checked;
    (sim as any).banterEnabled = on;
    save(K.on, on);
    refreshBtnLabel();
  });

  elProvider.addEventListener('change', () => {
    save(K.src, elProvider.value);
    applyProviderVisibility();
  });

  elUrl.addEventListener('change', () => save(K.url, elUrl.value.trim()));
  elModel.addEventListener('change', () => save(K.model, elModel.value));
  elTimeout.addEventListener('change', () => save(K.to, Math.max(500, Number(elTimeout.value) | 0)));
  elChars.addEventListener('change', () => save(K.chars, Math.max(40, Number(elChars.value) | 0)));
  elTemp.addEventListener('input', () => save(K.temp, Number(elTemp.value)));
  elTopP.addEventListener('input', () => save(K.topp, Number(elTopP.value)));
  elRep.addEventListener('input', () => save(K.rep, Number(elRep.value)));
  elIncl.addEventListener('change', () => save(K.incl, !!(elIncl as HTMLInputElement).checked));
  elEmoji.addEventListener('change', () => save(K.emoji, elEmoji.value));
  elProf.addEventListener('change', () => save(K.prof, elProf.value));
  elCd.addEventListener('change', () => save(K.cd, Math.max(0, Number(elCd.value) | 0)));
  elGap.addEventListener('change', () => save(K.gap, Math.max(0, Number(elGap.value) | 0)));
  for (const ev of events) {
    evChecks[ev].addEventListener('change', () => {
      const list = events.filter(e => !!evChecks[e].checked);
      save(K.ev, list.length === events.length ? '*' : list.join(','));
    });
  }

  // Ollama actions
  const populateModels = async (): Promise<void> => {
    status.textContent = '⏳';
    try {
      const models = await listOllamaModels(elUrl.value.trim(), Number(elTimeout.value) || 1500);
      elModel.innerHTML = '';
      if (!models.length) {
        const opt = document.createElement('option'); opt.value = ''; opt.text = '(no models)'; elModel.appendChild(opt);
      } else {
        for (const m of models) { const opt = document.createElement('option'); opt.value = m; opt.text = m; if (m === st.model) opt.selected = true; elModel.appendChild(opt); }
      }
      status.textContent = models.length ? '✅' : '⚠️';
    } catch {
      status.textContent = '❌';
    }
  };
  btnRefresh.addEventListener('click', (e) => { e.preventDefault(); void populateModels(); });

  btnTest.addEventListener('click', async (e) => {
    e.preventDefault();
    status.textContent = '⏳';
    const ok = await testOllamaChat(elUrl.value.trim(), elModel.value, Math.max(600, Number(elTimeout.value) | 0));
    status.textContent = ok ? '✅' : '❌';
  });

  if (st.provider === 'ollama') void populateModels();

  // --- Reset to defaults ---
  const resetWrap = document.createElement('div');
  resetWrap.className = 'audio-row buttons';
  const btnReset = document.createElement('button');
  btnReset.type = 'button'; btnReset.textContent = 'Reset to Defaults';
  resetWrap.appendChild(btnReset);
  pop.appendChild(resetWrap);

  const setUIFrom = (cfg: LLMSettings & { enabled: boolean }) => {
    // Enabled
    elOn.checked = cfg.enabled; (sim as any).banterEnabled = cfg.enabled; save(K.on, cfg.enabled);
    // Provider
    elProvider.value = cfg.provider; save(K.src, cfg.provider);
    applyProviderVisibility();
    // Ollama
    elUrl.value = cfg.ollamaUrl; save(K.url, cfg.ollamaUrl);
    // Model: reset to value (do not repopulate list here)
    // Clear options and insert placeholder + current if provided
    elModel.innerHTML = '';
    const opt0 = document.createElement('option'); opt0.value = ''; opt0.text = '(select model)'; elModel.appendChild(opt0);
    if (cfg.model) {
      const opt = document.createElement('option'); opt.value = cfg.model; opt.text = cfg.model; opt.selected = true; elModel.appendChild(opt);
    }
    save(K.model, cfg.model);
    status.textContent = '';
    // Quality & limits
    elTimeout.value = String(cfg.timeoutMs); save(K.to, cfg.timeoutMs);
    elChars.value = String(cfg.maxChars); save(K.chars, cfg.maxChars);
    elTemp.value = String(cfg.temperature); save(K.temp, cfg.temperature);
    elTopP.value = String(cfg.topP); save(K.topp, cfg.topP);
    elRep.value = String(cfg.repeatPenalty); save(K.rep, cfg.repeatPenalty);
    // Style & context
    elIncl.checked = cfg.includeOpponentLast; save(K.incl, cfg.includeOpponentLast);
    elEmoji.value = cfg.emojiStyle; save(K.emoji, cfg.emojiStyle);
    elProf.value = cfg.profanityFilter; save(K.prof, cfg.profanityFilter);
    // Pacing
    elCd.value = String(cfg.cooldownMs); save(K.cd, cfg.cooldownMs);
    elGap.value = String(cfg.sideMinGapMs); save(K.gap, cfg.sideMinGapMs);
    // Events
    const all = ['match_start','first_blood','big_hit','stagger','comeback','near_death','victory','taunt'];
    const mask = cfg.events === '*' ? new Set(all) : new Set(cfg.events.split(',').map(s=>s.trim()).filter(Boolean));
    for (const ev of all) { const on = mask.has(ev); evChecks[ev].checked = on; }
    save(K.ev, cfg.events);
    refreshBtnLabel();
  };

  btnReset.addEventListener('click', (e) => {
    e.preventDefault();
    setUIFrom({ ...DEFAULT_LLM, enabled: true });
  });

  // Position and open/close
  const positionPopover = (): void => {
    const r = btn.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.left = `${Math.round(r.right - pop.offsetWidth)}px`;
    pop.style.top = `${Math.round(r.bottom + 6)}px`;
  };
  let open = false;
  const close = (): void => {
    open = false; pop.style.display = 'none';
    window.removeEventListener('resize', positionPopover);
    document.removeEventListener('click', onDocClick, true);
  };
  const onDocClick = (e: MouseEvent): void => {
    if (!open) return; const t = e.target as Node | null;
    if (t && (t === pop || pop.contains(t) || t === btn)) return; close();
  };
  const toggle = (): void => {
    open = !open;
    if (open) {
      pop.style.display = 'block';
      positionPopover();
      window.addEventListener('resize', positionPopover);
      document.addEventListener('click', onDocClick, true);
    } else close();
  };
  btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
}

// Helper to read pacing when (re)creating the BanterSystem at match start
export function readBanterPacing(): { cooldownMs: number; sideMinGapMs: number } {
  try {
    const cooldownMs = loadNum(K.cd, DEFAULT_LLM.cooldownMs);
    const sideMinGapMs = loadNum(K.gap, DEFAULT_LLM.sideMinGapMs);
    return { cooldownMs, sideMinGapMs };
  } catch { return { cooldownMs: DEFAULT_LLM.cooldownMs, sideMinGapMs: DEFAULT_LLM.sideMinGapMs }; }
}
