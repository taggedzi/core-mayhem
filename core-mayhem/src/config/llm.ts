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
  // Event mask as comma-separated events or '*' for all
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
