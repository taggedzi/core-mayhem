// Non-secret defaults for LLM-driven banter. Secrets must never be shipped.

export type LLMProvider = 'deterministic' | 'ollama';

export interface LLMSettings {
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
  cooldownMs: 5000,
  sideMinGapMs: 12000,
  events: 'match_start,first_blood,big_hit,stagger,comeback,near_death,victory,taunt',
};

