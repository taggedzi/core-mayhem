import {
  DEFAULT_LLM,
  BANTER_CONFIG_VERSION,
  LLM_INPUTS,
  normalizeLLMSettings,
  type LLMSettings,
} from '../config/llm';
import { sim } from '../state';

const K = {
  on: 'cm_banterEnabled',
  llmOn: 'cm_banterLLMEnabled',
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
  ver: 'cm_banterConfigVersion',
} as const;

// Clear stale localStorage values when the config version changes so users
// always get fresh defaults after an update.
((): void => {
  try {
    const stored = Number(localStorage.getItem(K.ver));
    if (stored !== BANTER_CONFIG_VERSION) {
      const keys = Object.values(K).filter((k) => k !== K.ver);
      for (const k of keys) localStorage.removeItem(k);
      localStorage.setItem(K.ver, String(BANTER_CONFIG_VERSION));
    }
  } catch {
    /* ignore */
  }
})();

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function loadNum(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function loadStr(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: string | number | boolean): void {
  try {
    localStorage.setItem(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  } catch {
    /* ignore */
  }
}

function getInitial(): LLMSettings {
  const raw: LLMSettings = {
    llmEnabled: loadBool(K.llmOn, DEFAULT_LLM.llmEnabled),
    provider: loadStr(K.src, DEFAULT_LLM.provider) as any,
    ollamaUrl: loadStr(K.url, DEFAULT_LLM.ollamaUrl),
    model: loadStr(K.model, DEFAULT_LLM.model),
    timeoutMs: loadNum(K.to, DEFAULT_LLM.timeoutMs),
    maxChars: loadNum(K.chars, DEFAULT_LLM.maxChars),
    temperature: Number(loadNum(K.temp, DEFAULT_LLM.temperature).toFixed(2)),
    topP: Number(loadNum(K.topp, DEFAULT_LLM.topP).toFixed(2)),
    repeatPenalty: Number(loadNum(K.rep, DEFAULT_LLM.repeatPenalty).toFixed(2)),
    includeOpponentLast: loadBool(K.incl, DEFAULT_LLM.includeOpponentLast),
    emojiStyle: loadStr(K.emoji, DEFAULT_LLM.emojiStyle) as any,
    profanityFilter: loadStr(K.prof, DEFAULT_LLM.profanityFilter) as any,
    cooldownMs: loadNum(K.cd, DEFAULT_LLM.cooldownMs),
    sideMinGapMs: loadNum(K.gap, DEFAULT_LLM.sideMinGapMs),
    events: loadStr(K.ev, DEFAULT_LLM.events),
  };
  try {
    return normalizeLLMSettings(raw);
  } catch {
    return normalizeLLMSettings({
      ...raw,
      ollamaUrl: DEFAULT_LLM.ollamaUrl,
      provider: 'deterministic',
      llmEnabled: false,
    });
  }
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
    const data = await r.json().catch(() => ({}) as any);
    const arr = Array.isArray((data as any).models) ? (data as any).models : [];
    const names = arr.map((m: any) => String(m?.model ?? m?.name ?? '')).filter(Boolean);
    return names;
  } finally {
    clearTimeout(t);
  }
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
        {
          role: 'system',
          content: 'You are a concise test responder. Answer with a single short word.',
        },
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
    const data = await r.json().catch(() => ({}) as any);
    const msg =
      (data as any)?.message?.content ?? (data as any)?.choices?.[0]?.message?.content ?? '';
    return typeof msg === 'string' && msg.length > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function initBanterControls(): void {
  // P3: guard against being called more than once (popover is a singleton)
  if (document.getElementById('banterPopover')) return;

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
    inp.type = 'checkbox';
    inp.id = id;
    inp.checked = def;
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp;
  };

  const numberRow = (
    label: string,
    id: string,
    def: number,
    opts?: { min?: number; max?: number; step?: number },
  ): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.id = id;
    inp.value = String(def);
    if (opts?.min != null) inp.min = String(opts.min);
    if (opts?.max != null) inp.max = String(opts.max);
    if (opts?.step != null) inp.step = String(opts.step);
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp as HTMLInputElement;
  };

  const rangeRow = (
    label: string,
    id: string,
    def: number,
    opts: { min: number; max: number; step?: number },
  ): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.id = id;
    inp.value = String(def);
    inp.min = String(opts.min);
    inp.max = String(opts.max);
    if (opts.step != null) inp.step = String(opts.step);
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp as HTMLInputElement;
  };

  const textRow = (
    label: string,
    id: string,
    def: string,
    placeholder?: string,
  ): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.id = id;
    inp.value = def;
    if (placeholder) inp.placeholder = placeholder;
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp as HTMLInputElement;
  };

  const selectRow = (
    label: string,
    id: string,
    options: { value: string; label: string }[],
    def: string,
  ): HTMLSelectElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const sel = document.createElement('select');
    sel.id = id;
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.text = o.label;
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

  const elProvider = selectRow(
    'Source',
    'banterSource',
    [
      { value: 'deterministic', label: 'Deterministic' },
      { value: 'ollama', label: 'Ollama' },
    ],
    st.provider,
  );

  const elLLMOn = checkbox('Enable LLM calls', 'banterLLMEnabled', st.llmEnabled);

  // Ollama-specific
  const elUrl = textRow('Ollama URL', 'ollamaUrl', st.ollamaUrl, 'http://localhost:11434');

  // S2: mixed-content warning — shown when the page is served over HTTPS but the
  // configured Ollama URL uses plain HTTP. Browsers block such requests.
  const mixedContentWarn = document.createElement('div');
  mixedContentWarn.className = 'audio-row';
  mixedContentWarn.style.color = '#ffcc44';
  mixedContentWarn.style.fontSize = '11px';
  mixedContentWarn.style.display = 'none';
  mixedContentWarn.textContent =
    'Warning: page is on HTTPS but Ollama URL uses HTTP. Browsers block mixed-content requests. Use https:// for the Ollama URL.';
  pop.appendChild(mixedContentWarn);

  const updateMixedContentWarning = (): void => {
    const onHttpsPage = window.location.protocol === 'https:';
    const urlIsHttp = elUrl.value.trim().toLowerCase().startsWith('http:');
    const ollamaSelected = elProvider.value === 'ollama';
    mixedContentWarn.style.display = ollamaSelected && onHttpsPage && urlIsHttp ? 'block' : 'none';
  };
  updateMixedContentWarning();
  const elModel = selectRow(
    'Model',
    'ollamaModel',
    [
      { value: '', label: '(select model)' },
      ...(st.model ? [{ value: st.model, label: st.model }] : []),
    ],
    st.model || '',
  );
  const btnWrap = document.createElement('div');
  btnWrap.className = 'audio-row buttons';
  const btnRefresh = document.createElement('button');
  btnRefresh.type = 'button';
  btnRefresh.textContent = 'Refresh Models';
  const btnTest = document.createElement('button');
  btnTest.type = 'button';
  btnTest.textContent = 'Test';
  const status = document.createElement('span');
  status.style.marginLeft = '8px';
  status.textContent = '';
  btnWrap.append(btnRefresh, btnTest, status);
  pop.appendChild(btnWrap);

  const hdrQuality = headerRow('Quality & Limits');
  pop.appendChild(hdrQuality);
  const elTimeout = numberRow('Timeout (ms)', 'banterTimeout', st.timeoutMs, LLM_INPUTS.timeoutMs);
  const elChars = numberRow('Max Chars', 'banterMaxChars', st.maxChars, LLM_INPUTS.maxChars);
  const elTemp = rangeRow('Temperature', 'banterTemp', st.temperature, LLM_INPUTS.temperature);
  const elTopP = rangeRow('Top-p', 'banterTopP', st.topP, LLM_INPUTS.topP);
  const elRep = rangeRow(
    'Repeat Penalty',
    'banterRepeat',
    st.repeatPenalty,
    LLM_INPUTS.repeatPenalty,
  );

  pop.appendChild(headerRow('Style & Context'));
  const elIncl = checkbox(
    "Include opponent's last line",
    'banterIncludeOpp',
    st.includeOpponentLast,
  );
  const elEmoji = selectRow(
    'Emoji Style',
    'banterEmoji',
    [
      { value: 'inherit', label: 'Inherit character' },
      { value: 'none', label: 'None' },
      { value: 'emoji', label: 'Emoji' },
      { value: 'kaomoji', label: 'Kaomoji' },
    ],
    st.emojiStyle,
  );
  const elProf = selectRow(
    'Profanity Filter',
    'banterProf',
    [
      { value: 'off', label: 'Off' },
      { value: 'mild', label: 'Mild' },
      { value: 'strict', label: 'Strict' },
    ],
    st.profanityFilter,
  );

  pop.appendChild(headerRow('Pacing'));
  const elCd = numberRow('Cooldown (ms)', 'banterCooldown', st.cooldownMs, LLM_INPUTS.cooldownMs);
  const elGap = numberRow(
    'Side Min Gap (ms)',
    'banterGap',
    st.sideMinGapMs,
    LLM_INPUTS.sideMinGapMs,
  );

  pop.appendChild(headerRow('Events'));
  const events = [
    'match_start',
    'first_blood',
    'big_hit',
    'stagger',
    'comeback',
    'near_death',
    'victory',
    'taunt',
  ];
  const mask0 = new Set(
    st.events === '*'
      ? events
      : st.events
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
  );
  const evChecks: Record<string, HTMLInputElement> = {};
  for (const ev of events) {
    const cb = checkbox(ev, 'ev_' + ev, mask0.has(ev));
    evChecks[ev] = cb;
  }

  document.body.appendChild(pop);

  // Initial provider UI state
  const applyProviderVisibility = (): void => {
    const showOllama = elProvider.value === 'ollama';
    const d = (el: HTMLElement): void => {
      el.style.display = showOllama ? '' : 'none';
    };
    // Ollama connection
    d(elLLMOn.parentElement!);
    d(elUrl.parentElement!);
    d(elModel.parentElement!);
    d(btnWrap);
    // Quality & Limits — only meaningful for LLM calls
    d(hdrQuality);
    d(elTimeout.parentElement!);
    d(elChars.parentElement!);
    d(elTemp.parentElement!);
    d(elTopP.parentElement!);
    d(elRep.parentElement!);
    // Include opponent's last line — only used in LLM prompt building
    d(elIncl.parentElement!);
  };
  applyProviderVisibility();

  // Attach listeners & persistence
  const refreshBtnLabel = (): void => {
    const on = (sim as any).banterEnabled !== false;
    if (btn) {
      btn.textContent = on ? '💬 Banter' : '💬 Banter';
      btn.style.opacity = on ? '1' : '0.55';
    }
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
    updateMixedContentWarning();
  });

  elLLMOn.addEventListener('change', () => save(K.llmOn, !!(elLLMOn as HTMLInputElement).checked));

  let refreshGeneration = 0;
  const persistUI = (): LLMSettings | null => {
    const list = events.filter((ev) => evChecks[ev]?.checked);
    let cfg: LLMSettings;
    try {
      cfg = normalizeLLMSettings({
        llmEnabled: elLLMOn.checked,
        provider: elProvider.value as LLMSettings['provider'],
        ollamaUrl: elUrl.value,
        model: elModel.value,
        timeoutMs: Number(elTimeout.value),
        maxChars: Number(elChars.value),
        temperature: Number(elTemp.value),
        topP: Number(elTopP.value),
        repeatPenalty: Number(elRep.value),
        includeOpponentLast: elIncl.checked,
        emojiStyle: elEmoji.value as LLMSettings['emojiStyle'],
        profanityFilter: elProf.value as LLMSettings['profanityFilter'],
        cooldownMs: Number(elCd.value),
        sideMinGapMs: Number(elGap.value),
        events: list.length === events.length ? '*' : list.join(','),
      });
    } catch {
      elUrl.setCustomValidity('Enter a full URL starting with http:// or https://');
      status.textContent = 'Invalid URL';
      return null;
    }
    elUrl.setCustomValidity('');
    const values = [
      [K.on, elOn.checked],
      [K.src, cfg.provider],
      [K.llmOn, cfg.llmEnabled],
      [K.url, cfg.ollamaUrl],
      [K.model, cfg.model],
      [K.to, cfg.timeoutMs],
      [K.chars, cfg.maxChars],
      [K.temp, cfg.temperature],
      [K.topp, cfg.topP],
      [K.rep, cfg.repeatPenalty],
      [K.incl, cfg.includeOpponentLast],
      [K.emoji, cfg.emojiStyle],
      [K.prof, cfg.profanityFilter],
      [K.cd, cfg.cooldownMs],
      [K.gap, cfg.sideMinGapMs],
      [K.ev, cfg.events],
    ] as const;
    for (const [key, value] of values) save(key, value);
    for (const [control, value] of [
      [elTimeout, cfg.timeoutMs],
      [elChars, cfg.maxChars],
      [elTemp, cfg.temperature],
      [elTopP, cfg.topP],
      [elRep, cfg.repeatPenalty],
      [elCd, cfg.cooldownMs],
      [elGap, cfg.sideMinGapMs],
    ] as const)
      control.value = String(value);
    updateMixedContentWarning();
    return cfg;
  };
  elUrl.addEventListener('change', () => {
    refreshGeneration++;
    persistUI();
  });
  for (const control of [elModel, elTimeout, elChars, elIncl, elEmoji, elProf, elCd, elGap]) {
    control.addEventListener('change', () => {
      persistUI();
    });
  }
  for (const control of [elTemp, elTopP, elRep, ...Object.values(evChecks)]) {
    control.addEventListener(control.type === 'range' ? 'input' : 'change', () => {
      persistUI();
    });
  }

  // Ollama actions
  const populateModels = async (): Promise<void> => {
    const generation = ++refreshGeneration;
    const cfg = persistUI();
    if (!cfg) return;
    status.textContent = '⏳';
    try {
      const models = await listOllamaModels(cfg.ollamaUrl, cfg.timeoutMs);
      if (generation !== refreshGeneration || elUrl.value.trim() !== cfg.ollamaUrl) return;
      const selected = elModel.value;
      elModel.innerHTML = '';
      if (!models.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.text = '(no models)';
        elModel.appendChild(opt);
      } else {
        for (const m of models) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.text = m;
          if (m === selected) opt.selected = true;
          elModel.appendChild(opt);
        }
      }
      if (!models.includes(selected)) elModel.value = models[0] ?? '';
      save(K.model, elModel.value);
      status.textContent = models.length ? '✅' : '⚠️';
    } catch {
      if (generation === refreshGeneration) status.textContent = '❌';
    }
  };
  btnRefresh.addEventListener('click', (e) => {
    e.preventDefault();
    void populateModels();
  });

  btnTest.addEventListener('click', async (e) => {
    e.preventDefault();
    const cfg = persistUI();
    if (!cfg) return;
    status.textContent = '⏳';
    const ok = await testOllamaChat(cfg.ollamaUrl, cfg.model, cfg.timeoutMs);
    status.textContent = ok ? '✅' : '❌';
  });

  if (st.provider === 'ollama') void populateModels();

  // --- Save & Apply / Reset to defaults ---
  const actionWrap = document.createElement('div');
  actionWrap.className = 'audio-row buttons';
  const btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.textContent = 'Save & Apply';
  const btnReset = document.createElement('button');
  btnReset.type = 'button';
  btnReset.textContent = 'Reset to Defaults';
  actionWrap.append(btnSave, btnReset);
  pop.appendChild(actionWrap);

  const setUIFrom = (cfg: LLMSettings & { enabled: boolean }): void => {
    refreshGeneration++;
    // Enabled
    elOn.checked = cfg.enabled;
    (sim as any).banterEnabled = cfg.enabled;
    save(K.on, cfg.enabled);
    // Provider
    elProvider.value = cfg.provider;
    save(K.src, cfg.provider);
    applyProviderVisibility();
    // LLM enabled
    elLLMOn.checked = cfg.llmEnabled;
    save(K.llmOn, cfg.llmEnabled);
    // Ollama
    elUrl.value = cfg.ollamaUrl;
    elUrl.setCustomValidity('');
    save(K.url, cfg.ollamaUrl);
    updateMixedContentWarning();
    // Model: reset to value (do not repopulate list here)
    // Clear options and insert placeholder + current if provided
    elModel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.text = '(select model)';
    elModel.appendChild(opt0);
    if (cfg.model) {
      const opt = document.createElement('option');
      opt.value = cfg.model;
      opt.text = cfg.model;
      opt.selected = true;
      elModel.appendChild(opt);
    }
    save(K.model, cfg.model);
    status.textContent = '';
    // Quality & limits
    elTimeout.value = String(cfg.timeoutMs);
    save(K.to, cfg.timeoutMs);
    elChars.value = String(cfg.maxChars);
    save(K.chars, cfg.maxChars);
    elTemp.value = String(cfg.temperature);
    save(K.temp, cfg.temperature);
    elTopP.value = String(cfg.topP);
    save(K.topp, cfg.topP);
    elRep.value = String(cfg.repeatPenalty);
    save(K.rep, cfg.repeatPenalty);
    // Style & context
    elIncl.checked = cfg.includeOpponentLast;
    save(K.incl, cfg.includeOpponentLast);
    elEmoji.value = cfg.emojiStyle;
    save(K.emoji, cfg.emojiStyle);
    elProf.value = cfg.profanityFilter;
    save(K.prof, cfg.profanityFilter);
    // Pacing
    elCd.value = String(cfg.cooldownMs);
    save(K.cd, cfg.cooldownMs);
    elGap.value = String(cfg.sideMinGapMs);
    save(K.gap, cfg.sideMinGapMs);
    // Events
    const all = [
      'match_start',
      'first_blood',
      'big_hit',
      'stagger',
      'comeback',
      'near_death',
      'victory',
      'taunt',
    ];
    const mask =
      cfg.events === '*'
        ? new Set(all)
        : new Set(
            cfg.events
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          );
    for (const ev of all) {
      const on = mask.has(ev);
      const cb = evChecks[ev];
      if (cb) cb.checked = on;
    }
    save(K.ev, cfg.events);
    refreshBtnLabel();
  };

  btnSave.addEventListener('click', (e) => {
    e.preventDefault();
    if (!persistUI()) return;
    // Reset the in-game pacing gate so new timing takes effect immediately
    try {
      (sim as any).banterGate = { L: 0, R: 0, lastAny: 0 };
    } catch {
      /* ignore */
    }
    // Brief visual confirmation
    const prev = btnSave.textContent;
    btnSave.textContent = 'Saved ✓';
    setTimeout(() => {
      btnSave.textContent = prev;
    }, 1200);
  });

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
    open = false;
    pop.style.display = 'none';
    window.removeEventListener('resize', positionPopover);
    document.removeEventListener('click', onDocClick, true);
  };
  const onDocClick = (e: MouseEvent): void => {
    if (!open) return;
    const t = e.target as Node | null;
    if (t && (t === pop || pop.contains(t) || t === btn)) return;
    close();
  };
  const toggle = (): void => {
    open = !open;
    if (open) {
      pop.style.display = 'block';
      positionPopover();
      updateMixedContentWarning();
      window.addEventListener('resize', positionPopover);
      document.addEventListener('click', onDocClick, true);
    } else close();
  };
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });
}

// Helper to read pacing when (re)creating the BanterSystem at match start
export function readBanterPacing(): { cooldownMs: number; sideMinGapMs: number } {
  try {
    const { cooldownMs, sideMinGapMs } = getInitial();
    return { cooldownMs, sideMinGapMs };
  } catch {
    return { cooldownMs: DEFAULT_LLM.cooldownMs, sideMinGapMs: DEFAULT_LLM.sideMinGapMs };
  }
}
