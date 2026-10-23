import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { invalidateBanterRequests } from '../app/banterRequests';
import { sim, resetSimState } from '../state';

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
});
