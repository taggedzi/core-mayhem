import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { invalidateBanterRequests } from '../app/banterRequests';
import { BANTER_CONFIG_VERSION, DEFAULT_LLM, normalizeLLMSettings } from '../config/llm';
import { sim, resetSimState } from '../state';

import type { LLMSettings } from '../config/llm';

// Mocks for dependencies
vi.mock('../banter/llm/ollama', () => ({
  ollamaChat: vi.fn(),
}));
vi.mock('../ui/banterControls', () => ({
  readLLMSettings: vi.fn(),
  readBanterPacing: vi.fn(),
}));
vi.mock('../render/banter', () => ({
  setBanter: vi.fn(),
  clearBanter: vi.fn(),
}));

const ollama = await import('../banter/llm/ollama');
const ui = await import('../ui/banterControls');
const overlay = await import('../render/banter');
let speakBanterSmart: (ev: any, side: 'L' | 'R') => Promise<void>;

function seedSimBasics(): void {
  (sim as any).banterEnabled = true;
  (sim as any).banter = { speak: vi.fn().mockReturnValue({ text: 'hi honey' }) };
  (sim as any).banterL = {
    id: 'left',
    displayName: 'Left',
    personality: { aggression: 0.2, humor: 0.5, formality: 0.5, optimism: 0.5, sarcasm: 0.3 },
  };
  (sim as any).banterR = {
    id: 'right',
    displayName: 'Right',
    personality: { aggression: 0.8, humor: 0.3, formality: 0.5, optimism: 0.5, sarcasm: 0.6 },
  };
  (sim as any).coreL = { centerHP: 50 };
  (sim as any).coreR = { centerHP: 70 };
  (sim as any).banterUI = { L: { text: '', t0: 0, until: 0 }, R: { text: '', t0: 0, until: 0 } };
}

function setLLMSettings(partial: any = {}, enabled = true): void {
  const base = {
    llmEnabled: true,
    provider: 'ollama',
    ollamaUrl: 'http://local',
    model: 'tiny',
    timeoutMs: 800,
    maxChars: 100,
    temperature: 0.7,
    topP: 0.9,
    repeatPenalty: 1.1,
    includeOpponentLast: false,
    emojiStyle: 'inherit',
    profanityFilter: 'off',
    cooldownMs: 0,
    sideMinGapMs: 0,
    events: '*',
    ...partial,
  } as any;
  (ui.readLLMSettings as unknown as vi.Mock).mockReturnValue({ enabled, settings: base });
}

function setPacing(p: { cooldownMs?: number; sideMinGapMs?: number } = {}): void {
  (ui.readBanterPacing as unknown as vi.Mock).mockReturnValue({
    cooldownMs: 0,
    sideMinGapMs: 0,
    ...p,
  });
}

describe('speakBanterSmart', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    invalidateBanterRequests();
    // import MUT after mocks are ready
    const mod = await import('../app/speakBanterLLM');
    speakBanterSmart = mod.speakBanterSmart;
    seedSimBasics();
    setLLMSettings();
    setPacing();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    (ollama.ollamaChat as unknown as vi.Mock).mockResolvedValue('ok');
    (sim as any).banterSeq = undefined;
    (sim as any).banterGate = undefined;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('an empty event mask sends no generated request', async () => {
    setLLMSettings({ events: '' });
    await speakBanterSmart('taunt', 'L');
    expect(ollama.ollamaChat).not.toHaveBeenCalled();
  });

  it('returns early when banter system or characters missing', async () => {
    (sim as any).banter = null;
    await speakBanterSmart('taunt' as any, 'L');
    expect(overlay.setBanter as unknown as vi.Mock).not.toHaveBeenCalled();
  });

  it('respects global disable flag', async () => {
    (sim as any).banterEnabled = false;
    await speakBanterSmart('taunt' as any, 'L');
    expect(overlay.setBanter as unknown as vi.Mock).not.toHaveBeenCalled();
  });

  it('does nothing when LLM settings.disabled', async () => {
    setLLMSettings({}, false);
    await speakBanterSmart('taunt' as any, 'L');
    expect(overlay.setBanter as unknown as vi.Mock).not.toHaveBeenCalled();
  });

  it('falls back immediately when event not allowed', async () => {
    setLLMSettings({ events: 'victory' });
    await speakBanterSmart('taunt' as any, 'L');
    // fallback path uses stripEndearments()
    expect(overlay.setBanter as unknown as vi.Mock).toHaveBeenCalledWith(
      'L',
      expect.stringContaining('you'),
    );
  });

  it('uses fallback when provider is not ollama', async () => {
    setLLMSettings({ provider: 'deterministic' });
    await speakBanterSmart('taunt' as any, 'L');
    expect(overlay.setBanter as unknown as vi.Mock).toHaveBeenCalled();
  });

  it('honors pacing gate and returns without speaking if too soon', async () => {
    // Seed gate timestamps to block side and any
    (sim as any).banterGate = { L: 900, R: 900, lastAny: 980 };
    setLLMSettings({ sideMinGapMs: 5000 });
    await speakBanterSmart('taunt' as any, 'L');
    expect(overlay.setBanter as unknown as vi.Mock).not.toHaveBeenCalled();
  });

  it('LLM success path: transforms response with filters and punctuation', async () => {
    setLLMSettings({ emojiStyle: 'none', profanityFilter: 'mild' });
    (ollama.ollamaChat as unknown as vi.Mock).mockResolvedValueOnce('damn 😎 hello honey');
    await speakBanterSmart('taunt' as any, 'R');
    expect(overlay.setBanter as unknown as vi.Mock).toHaveBeenCalled();
    const [sideArg, textRaw] = (overlay.setBanter as unknown as vi.Mock).mock.calls[0];
    expect(sideArg).toBe('R');
    const text = String(textRaw);
    expect(text).toContain('****'); // profanity masked
    expect(text).not.toMatch(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u); // emoji removed
    expect(text.endsWith('.')).toBe(true); // terminal punctuation
  });

  it('LLM empty response: falls back to deterministic speak()', async () => {
    (ollama.ollamaChat as unknown as vi.Mock).mockResolvedValueOnce('');
    await speakBanterSmart('big_hit' as any, 'L');
    expect(overlay.setBanter as unknown as vi.Mock).toHaveBeenCalled();
  });

  it('keeps the first request and drops repeated events until it resolves', async () => {
    // First call: keep the promise pending
    let resolveFirst: (v: any) => void;
    const first = new Promise<string>((res) => {
      resolveFirst = res;
    });
    (ollama.ollamaChat as unknown as vi.Mock).mockReturnValueOnce(first);
    const p1 = speakBanterSmart('taunt' as any, 'L');
    // Second call while inflight should use fallback path
    await speakBanterSmart('taunt' as any, 'L');
    expect(overlay.setBanter).not.toHaveBeenCalled();
    expect(ollama.ollamaChat).toHaveBeenCalledTimes(1);
    // Now resolve first
    resolveFirst!('ok');
    await p1;
    expect(overlay.setBanter).toHaveBeenCalledTimes(1);
  });
  it.each(['reply', 'empty', 'error'])(
    'discards stale %s completions across match reset',
    async (outcome) => {
      let resolve!: (text: string) => void;
      let reject!: (error: Error) => void;
      vi.mocked(ollama.ollamaChat).mockReturnValueOnce(
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      const task = speakBanterSmart('taunt', 'L');
      const signal = vi.mocked(ollama.ollamaChat).mock.calls[0]![6]!;
      resetSimState();
      seedSimBasics();
      expect(signal.aborted).toBe(true);
      if (outcome === 'error') reject(new Error('late failure'));
      else resolve(outcome === 'reply' ? 'old character reply' : '');
      await task;
      expect(overlay.setBanter).not.toHaveBeenCalled();
    },
  );

  it('discards a pending reply after LLM calls are disabled', async () => {
    let resolve!: (text: string) => void;
    vi.mocked(ollama.ollamaChat).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const task = speakBanterSmart('taunt', 'L');
    setLLMSettings({ llmEnabled: false });
    resolve('late reply');
    await task;
    expect(overlay.setBanter).not.toHaveBeenCalled();
  });

  it('an old completion cannot clear the new match pending request', async () => {
    const resolves: ((text: string) => void)[] = [];
    vi.mocked(ollama.ollamaChat).mockImplementation(
      () =>
        new Promise((done) => {
          resolves.push(done);
        }),
    );
    const oldTask = speakBanterSmart('taunt', 'L');
    resetSimState();
    seedSimBasics();
    const newTask = speakBanterSmart('taunt', 'L');
    resolves[0]!('stale');
    await oldTask;
    await speakBanterSmart('taunt', 'L');
    expect(ollama.ollamaChat).toHaveBeenCalledTimes(2);
    resolves[1]!('current');
    await newTask;
    expect(overlay.setBanter).toHaveBeenCalledTimes(1);
    expect(overlay.setBanter).toHaveBeenCalledWith('L', 'current.');
  });

  it('allows both opening speakers immediately on a freshly loaded page', async () => {
    vi.mocked(performance.now).mockReturnValue(0);
    setLLMSettings({ provider: 'deterministic' });
    setPacing({ cooldownMs: 8000, sideMinGapMs: 25000 });
    await speakBanterSmart('match_start', 'L');
    await speakBanterSmart('match_start', 'R');
    expect(overlay.setBanter).toHaveBeenCalledTimes(2);
    expect(overlay.setBanter).toHaveBeenCalledWith('L', expect.any(String));
    expect(overlay.setBanter).toHaveBeenCalledWith('R', expect.any(String));
  });

  it('uses the same emoji and profanity controls for deterministic output', async () => {
    (sim as any).banter.speak.mockReturnValue({ text: 'damn 😎 honey' });
    setLLMSettings({ provider: 'deterministic', emojiStyle: 'none', profanityFilter: 'mild' });
    await speakBanterSmart('taunt', 'L');
    expect(overlay.setBanter).toHaveBeenCalledWith('L', '**** you');
  });

  it('updates active pacing and clears displayed lines from the settings controls', async () => {
    const actualUI = await vi.importActual<{ initBanterControls(): void }>('../ui/banterControls');
    localStorage.clear();
    document.body.innerHTML = '<button id="btnBanter">Banter</button>';
    const updatePacing = vi.fn();
    (sim as any).banter = { updatePacing };
    actualUI.initBanterControls();
    const cooldown = document.getElementById('banterCooldown') as HTMLInputElement;
    cooldown.value = '2000';
    cooldown.dispatchEvent(new Event('change'));
    expect(updatePacing).toHaveBeenCalledWith({ cooldownMs: 2000, sideMinGapMs: 0 });
    const enabled = document.getElementById('banterEnabled') as HTMLInputElement;
    enabled.checked = false;
    enabled.dispatchEvent(new Event('change'));
    expect(overlay.clearBanter).toHaveBeenCalled();
    expect((sim as any).banterEnabled).toBe(false);
    localStorage.clear();
    document.body.innerHTML = '';
  });
});

describe('banter settings validation and model state', () => {
  let actualUI: { initBanterControls(): void; readLLMSettings(): { settings: LLMSettings } };
  beforeEach(async () => {
    vi.restoreAllMocks();
    actualUI = await vi.importActual('../ui/banterControls');
    localStorage.clear();
    localStorage.setItem('cm_banterConfigVersion', String(BANTER_CONFIG_VERSION));
    document.body.innerHTML = '<button id="btnBanter">Banter</button>';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.body.innerHTML = '';
  });
  const input = (id: string): HTMLInputElement => document.getElementById(id) as HTMLInputElement;
  const button = (text: string): HTMLButtonElement =>
    Array.from(document.querySelectorAll('button')).find(
      (element) => element.textContent === text,
    )!;

  it('normalizes stored numeric bounds and rejects invalid URL protocols', () => {
    expect(() =>
      normalizeLLMSettings({ ...DEFAULT_LLM, ollamaUrl: 'javascript:alert(1)' }),
    ).toThrow();
    localStorage.setItem('cm_banterTimeoutMs', '99999');
    localStorage.setItem('cm_banterMaxChars', '-10');
    localStorage.setItem('cm_banterCooldownMs', '99999');
    localStorage.setItem('cm_banterSideGapMs', '-1');
    const { settings } = actualUI.readLLMSettings();
    expect(settings).toMatchObject({
      timeoutMs: 8000,
      maxChars: 60,
      cooldownMs: 20000,
      sideMinGapMs: 2000,
    });
  });

  it('Save, Test, Refresh and change all reject invalid URLs', () => {
    actualUI.initBanterControls();
    vi.stubGlobal('fetch', vi.fn());
    input('ollamaUrl').value = 'file:///private';
    input('ollamaUrl').dispatchEvent(new Event('change'));
    for (const text of ['Save & Apply', 'Test', 'Refresh Models']) button(text).click();
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem('cm_ollamaUrl')).toBeNull();
    expect(input('ollamaUrl').validationMessage).toContain('http');
  });

  it('clamps Save values and persists an empty event selection', () => {
    actualUI.initBanterControls();
    input('banterTimeout').value = '99999';
    input('banterMaxChars').value = '1';
    for (const checkbox of document.querySelectorAll<HTMLInputElement>('[id^="ev_"]'))
      checkbox.checked = false;
    button('Save & Apply').click();
    expect(input('banterTimeout').value).toBe('8000');
    expect(input('banterMaxChars').value).toBe('60');
    expect(actualUI.readLLMSettings().settings.events).toBe('');
  });

  it('persists automatic model selection and ignores out-of-order refresh responses', async () => {
    actualUI.initBanterControls();
    const resolves: ((response: any) => void)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolves.push(resolve);
          }),
      ),
    );
    button('Refresh Models').click();
    button('Refresh Models').click();
    resolves[1]!({
      ok: true,
      json: async () => ({ models: [{ name: 'new' }, { name: 'chosen' }] }),
    });
    await vi.waitFor(() => expect(actualUI.readLLMSettings().settings.model).toBe('new'));
    input('ollamaModel').value = 'chosen';
    input('ollamaModel').dispatchEvent(new Event('change'));
    resolves[0]!({ ok: true, json: async () => ({ models: [{ name: 'stale' }] }) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input('ollamaModel').value).toBe('chosen');
    expect(actualUI.readLLMSettings().settings.model).toBe('chosen');
    button('Test').click();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[2]![1]!.body as string).model).toBe('chosen');
    resolves[2]!({ ok: true, json: async () => ({ message: { content: 'ok' } }) });
  });

  it('retains the saved selected model after rebuilding controls', () => {
    localStorage.setItem('cm_ollamaModel', 'saved-model');
    actualUI.initBanterControls();
    expect(input('ollamaModel').value).toBe('saved-model');
    expect(actualUI.readLLMSettings().settings.model).toBe('saved-model');
  });
});
