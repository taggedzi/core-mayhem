export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  repeat_penalty?: number;
}

export async function ollamaChat(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  opts: OllamaOptions,
  timeoutMs: number,
): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(300, timeoutMs | 0));
  try {
    const url = baseUrl.replace(/\/$/, '') + '/api/chat';
    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.8,
        top_p: opts.top_p ?? 0.9,
        repeat_penalty: opts.repeat_penalty ?? 1.1,
      },
    } as const;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => ({} as any));
    const content = (data as any)?.message?.content ?? (data as any)?.choices?.[0]?.message?.content ?? '';
    if (typeof content !== 'string') return null;
    return content;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

