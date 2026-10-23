// Non-secret defaults for LLM-driven banter. Secrets must never be shipped.
// Bump this when defaults change so stale localStorage values are cleared.
export const BANTER_CONFIG_VERSION = 3;

export type LLMProvider = 'deterministic' | 'ollama';

export interface LLMSettings {
  /** Master switch for LLM calls. Must be explicitly true — defaults to false. */
  llmEnabled: boolean;
  provider: LLMProvider;
  ollamaUrl: string;
  model: string;
  timeoutMs: number;
  maxChars: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  includeOpponentLast: boolean;
  emojiStyle: 'inherit' | 'none' | 'emoji' | 'kaomoji';
  profanityFilter: 'off' | 'mild' | 'strict';
  // Pacing to keep LLM and deterministic outputs feeling similar
  cooldownMs: number;
  sideMinGapMs: number;
  // Event mask as comma-separated events, '*' for all, or empty for no LLM events.
  events: string; // e.g., "match_start,first_blood,big_hit,stagger,comeback,near_death,victory,taunt"
}

export const DEFAULT_LLM: Readonly<LLMSettings> = {
  llmEnabled: false,
  provider: 'deterministic',
  ollamaUrl: 'http://localhost:11434',
  model: '',
  timeoutMs: 2000,
  maxChars: 140,
  temperature: 0.8,
  topP: 0.9,
  repeatPenalty: 1.1,
  includeOpponentLast: true,
  emojiStyle: 'inherit',
  profanityFilter: 'mild',
  cooldownMs: 8000,
  sideMinGapMs: 25000,
  events: 'match_start,first_blood,big_hit,stagger,comeback,near_death,victory,taunt',
};

export const LLM_INPUTS = {
  timeoutMs: { min: 500, max: 8000, step: 100 },
  maxChars: { min: 60, max: 240, step: 10 },
  temperature: { min: 0, max: 1, step: 0.01 },
  topP: { min: 0, max: 1, step: 0.01 },
  repeatPenalty: { min: 1, max: 2, step: 0.05 },
  cooldownMs: { min: 1000, max: 20000, step: 250 },
  sideMinGapMs: { min: 2000, max: 30000, step: 500 },
} as const;

/** Shared validation for storage, editing, Save, Test and model refresh. */
export function normalizeLLMSettings(input: LLMSettings): LLMSettings {
  const url = new URL(input.ollamaUrl.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('URL must use http:// or https://');
  const result = { ...input, ollamaUrl: input.ollamaUrl.trim(), model: input.model.trim() };
  for (const key of Object.keys(LLM_INPUTS) as (keyof typeof LLM_INPUTS)[]) {
    const { min, max } = LLM_INPUTS[key];
    const value = Number(input[key]);
    result[key] = Math.min(max, Math.max(min, Number.isFinite(value) ? value : DEFAULT_LLM[key]));
  }
  result.provider = input.provider === 'ollama' ? 'ollama' : 'deterministic';
  result.emojiStyle = ['inherit', 'none', 'emoji', 'kaomoji'].includes(input.emojiStyle)
    ? input.emojiStyle
    : DEFAULT_LLM.emojiStyle;
  result.profanityFilter = ['off', 'mild', 'strict'].includes(input.profanityFilter)
    ? input.profanityFilter
    : DEFAULT_LLM.profanityFilter;
  result.events = input.events.trim(); // '*' means all; empty means none.
  return result;
}
