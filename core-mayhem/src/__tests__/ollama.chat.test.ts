import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ollamaChat } from '../banter/llm/ollama';

// Helper to parse the body we send to fetch
const getBody = (call: any): any => JSON.parse(call[1]?.body ?? '{}');

describe('ollamaChat', () => {
  const base = 'http://localhost:11434/';
  const model = 'tinyllama';
  const system = 'system prompt';
  const user = 'user prompt';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('posts to /api/chat and returns message.content when ok', async () => {
    (globalThis.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: 'hello world' } }),
    });

    const out = await ollamaChat(base, model, system, user, {}, 1000);
    expect(out).toBe('hello world');

    // correct URL and options
    const call = (globalThis.fetch as unknown as vi.Mock).mock.calls[0];
    expect(call[0]).toBe('http://localhost:11434/api/chat');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Content-Type']).toBe('application/json');

    // body contains defaults when opts are missing
    const body = getBody(call);
    expect(body.model).toBe(model);
    expect(body.messages).toEqual([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    expect(body.stream).toBe(false);
    expect(body.options).toEqual({ temperature: 0.8, top_p: 0.9, repeat_penalty: 1.1 });

    // pending timeout cleared in finally
    expect(vi.getTimerCount()).toBe(0);
  });

  it('falls back to choices[0].message.content', async () => {
    (globalThis.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'alt' } }] }),
    });

    const out = await ollamaChat(base, model, system, user, { temperature: 0.1 }, 1000);
    expect(out).toBe('alt');
  });

  it('returns null on non-ok response', async () => {
    (globalThis.fetch as unknown as vi.Mock).mockResolvedValueOnce({ ok: false });
    const out = await ollamaChat(base, model, system, user, {}, 1000);
    expect(out).toBeNull();
  });

  it('returns null when content is not a string', async () => {
    (globalThis.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: 123 } }),
    });
    const out = await ollamaChat(base, model, system, user, {}, 1000);
    expect(out).toBeNull();
  });

  it('returns empty string when neither message nor choices present', async () => {
    (globalThis.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const out = await ollamaChat(base, model, system, user, {}, 1000);
    expect(out).toBe('');
  });

  it('handles JSON parse failure by using {} and returning empty string', async () => {
    (globalThis.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new Error('bad json'); },
    });
    const out = await ollamaChat(base, model, system, user, {}, 1000);
    expect(out).toBe('');
  });

  it('returns null when fetch throws', async () => {
    (globalThis.fetch as unknown as vi.Mock).mockRejectedValueOnce(new Error('network'));
    const out = await ollamaChat(base, model, system, user, {}, 1000);
    expect(out).toBeNull();
  });

  it('aborts after timeout and returns null', async () => {
    // Simulate a hanging fetch that rejects on abort
    (globalThis.fetch as unknown as vi.Mock).mockImplementationOnce((_url: string, init: any) => {
      const sig: AbortSignal = init.signal;
      return new Promise((_resolve, reject) => {
        const onAbort = () => reject(new Error('aborted'));
        if (sig.aborted) reject(new Error('aborted'));
        else sig.addEventListener('abort', onAbort, { once: true });
      });
    });

    const p = ollamaChat(base, model, system, user, {}, 10);
    // minimum enforced is 300ms
    vi.advanceTimersByTime(300);
    const out = await p;
    expect(out).toBeNull();
    expect((globalThis.fetch as unknown as vi.Mock).mock.calls.length).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
