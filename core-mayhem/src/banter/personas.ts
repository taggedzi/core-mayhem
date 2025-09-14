import * as P from './personalities';

import type { Personality } from './index';

function isPersonality(o: any): o is Personality {
  return !!o && typeof o === 'object'
    && typeof o.name === 'string'
    && typeof o.aggression === 'number'
    && typeof o.humor === 'number'
    && typeof o.formality === 'number'
    && typeof o.optimism === 'number'
    && typeof o.sarcasm === 'number';
}

/**
 * PERSONA_CATALOG is generated from all named exports in personalities.ts
 * that look like a Personality (by shape). Add new personas there and they'll
 * appear here automatically.
 */
export const PERSONA_CATALOG: Readonly<Record<string, Personality>> = Object.freeze(
  Object.fromEntries(
    Object.entries(P)
      .filter(([, v]) => isPersonality(v))
      .map(([k, v]) => [k, v as Personality])
  )
);

export default PERSONA_CATALOG;
