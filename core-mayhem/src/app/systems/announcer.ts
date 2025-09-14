import { announcer } from '../../announcer';
import { ANNOUNCER_THRESHOLDS } from '../../announcer/config';
import { MATCH_LIMIT } from '../../config';
import { sim } from '../../state';
// import { SIDE } from '../../types';
// setBanter handled via speakBanterSmart
import { speakBanterSmart } from '../speakBanterLLM';

// Local rolling state for detectors
let lastMatchIndex = -1;
let didFirstCenterDamage = false;
let prevCenterL = 0;
let prevCenterR = 0;
let dangerSpokenL = false;
let dangerSpokenR = false;
let lastAdvSign = 0;
let lastShiftAt = 0;
let countdown10 = false;
let countdown3 = false;
let minAdvSoFar = 0; // most negative (L behind)
let maxAdvSoFar = 0; // most positive (R behind)
let comebackLevelL = 0; // 1=noticeable,2=major,3=epic (spoken)
let comebackLevelR = 0;

export function resetAnnouncerState(): void {
  lastMatchIndex = -1;
  didFirstCenterDamage = false;
  prevCenterL = 0;
  prevCenterR = 0;
  dangerSpokenL = false;
  dangerSpokenR = false;
  lastAdvSign = 0;
  lastShiftAt = 0;
  countdown10 = false;
  countdown3 = false;
  minAdvSoFar = 0;
  maxAdvSoFar = 0;
  comebackLevelL = 0;
  comebackLevelR = 0;
}

export function runAnnouncer(): void {
  const idx = (sim as any).matchIndex | 0;
  if (idx !== lastMatchIndex) {
    // New match: seed state and fire pre-game + ready/go
    lastMatchIndex = idx;
    didFirstCenterDamage = false;
    dangerSpokenL = false;
    dangerSpokenR = false;
    countdown10 = false;
    countdown3 = false;
    const cL: any = (sim as any).coreL;
    const cR: any = (sim as any).coreR;
    prevCenterL = Number(cL?.centerHP ?? 0);
    prevCenterR = Number(cR?.centerHP ?? 0);
    // sequence: pre-game line, then ready, then go (relies on minGapMs spacing)
    announcer.trigger('pre_game');
    announcer.trigger('match_start_ready');
    announcer.trigger('match_start_go');
    // Banter: both sides greet at match start
    try {
      speakBanter('match_start', 'L');
      speakBanter('match_start', 'R');
    } catch { /* ignore */ }
  }

  const now = performance.now();
  const cL: any = (sim as any).coreL;
  const cR: any = (sim as any).coreR;
  if (!cL || !cR || (sim as any).gameOver) {
    announcer.run(now);
    return;
  }

  // First center damage detection
  if (!didFirstCenterDamage) {
    const dL = Math.max(0, prevCenterL - (cL.centerHP | 0));
    const dR = Math.max(0, prevCenterR - (cR.centerHP | 0));
    if (dL > 0 || dR > 0) {
      announcer.trigger('first_core_damage');
      didFirstCenterDamage = true;
      try {
        if (dL > dR) speakBanter('first_blood', 'R');
        else /* dR >= dL */ speakBanter('first_blood', 'L');
      } catch { /* ignore */ }
    }
  }

  // Per-tick swing between sides: |(damage to L) - (damage to R)|
  const dropL = Math.max(0, prevCenterL - (cL.centerHP | 0));
  const dropR = Math.max(0, prevCenterR - (cR.centerHP | 0));
  const swing = Math.abs(dropL - dropR);
  if (swing >= ANNOUNCER_THRESHOLDS.swingExtreme) {
    announcer.trigger('extreme_event', { urgent: true });
    try { if (dropL > dropR) speakBanter('big_hit', 'R'); else if (dropR > dropL) speakBanter('big_hit', 'L'); } catch { /* ignore */ }
  } else if (swing >= ANNOUNCER_THRESHOLDS.swingMajor) {
    announcer.trigger('major_swing');
    try { if (dropL > dropR) speakBanter('big_hit', 'R'); else if (dropR > dropL) speakBanter('big_hit', 'L'); } catch { /* ignore */ }
  } else if (swing >= ANNOUNCER_THRESHOLDS.swingHigh) {
    announcer.trigger('high_damage');
    try { if (dropL > dropR) speakBanter('big_hit', 'R'); else if (dropR > dropL) speakBanter('big_hit', 'L'); } catch { /* ignore */ }
  }

  // In danger: once per side when crossing low HP threshold
  const lowThr = Math.max(0, Math.min(1, ANNOUNCER_THRESHOLDS.lowHPpct));
  const lowL = (cL.centerHP | 0) > 0 && (cL.centerHP | 0) / ((cL.centerHPmax ?? 1)) <= lowThr;
  const lowR = (cR.centerHP | 0) > 0 && (cR.centerHP | 0) / ((cR.centerHPmax ?? 1)) <= lowThr;
  if (lowL && !dangerSpokenL) { announcer.trigger('core_in_danger_L'); dangerSpokenL = true; try { speakBanter('near_death', 'L'); } catch { /* ignore */ } }
  if (lowR && !dangerSpokenR) { announcer.trigger('core_in_danger_R'); dangerSpokenR = true; try { speakBanter('near_death', 'R'); } catch { /* ignore */ } }

  // Momentum / advantage computations
  const adv = (cL.centerHP | 0) - (cR.centerHP | 0); // positive = L ahead, negative = R ahead
  const sign = Math.sign(adv);
  const magThr = Math.max(1, Math.floor((((cL.centerHPmax ?? 1) + (cR.centerHPmax ?? 1)) * 0.5 * ANNOUNCER_THRESHOLDS.momentumShiftPctOfCenter)));
  if (sign !== 0 && lastAdvSign !== 0 && sign !== lastAdvSign) {
    if (Math.abs(adv) >= magThr && (now - lastShiftAt) >= ANNOUNCER_THRESHOLDS.momentumWindowMs) {
      announcer.trigger('momentum_shift');
      lastShiftAt = now;
      try { if (sign > 0) speakBanter('comeback', 'L'); else if (sign < 0) speakBanter('comeback', 'R'); } catch { /* ignore */ }
    }
  }
  if (sign !== 0) lastAdvSign = sign;

  // Track worst deficits and detect comeback amounts for each side
  if (adv < minAdvSoFar) minAdvSoFar = adv; // L worst deficit (most negative)
  if (adv > maxAdvSoFar) maxAdvSoFar = adv; // R worst deficit (most positive)

  // Comeback amounts relative to worst points
  // L comeback: from minAdvSoFar toward zero (only meaningful if minAdvSoFar < 0)
  const start = (sim as any).matchStart ?? 0;
  const elapsed = performance.now() - start;
  const total = (() => {
    const matchMs = (sim as any).settings?.matchMs as number | undefined;
    if (typeof matchMs === 'number') return matchMs;
    const raw = (MATCH_LIMIT as any).ms as unknown;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  })();
  const frac = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  const lateBoost = frac >= 0.75 ? 1 : 0; // boost priorities in last 25% of time

  if (minAdvSoFar < 0) {
    const regainedL = adv - minAdvSoFar; // becomes larger as adv rises from negative
    if (comebackLevelL < 3 && regainedL >= ANNOUNCER_THRESHOLDS.comebackEpic) { announcer.trigger('comeback_epic', { urgent: true, priorityBoost: lateBoost + 1 }); comebackLevelL = 3; }
    else if (comebackLevelL < 2 && regainedL >= ANNOUNCER_THRESHOLDS.comebackMajor) { announcer.trigger('comeback_major', { priorityBoost: lateBoost }); comebackLevelL = 2; }
    else if (comebackLevelL < 1 && regainedL >= ANNOUNCER_THRESHOLDS.comebackNoticeable) { announcer.trigger('comeback_noticeable', { priorityBoost: lateBoost }); comebackLevelL = 1; }
  }
  // R comeback: from maxAdvSoFar toward zero (only meaningful if maxAdvSoFar > 0)
  if (maxAdvSoFar > 0) {
    const regainedR = maxAdvSoFar - adv; // becomes larger as adv falls from positive
    if (comebackLevelR < 3 && regainedR >= ANNOUNCER_THRESHOLDS.comebackEpic) { announcer.trigger('comeback_epic', { urgent: true, priorityBoost: lateBoost + 1 }); comebackLevelR = 3; }
    else if (comebackLevelR < 2 && regainedR >= ANNOUNCER_THRESHOLDS.comebackMajor) { announcer.trigger('comeback_major', { priorityBoost: lateBoost }); comebackLevelR = 2; }
    else if (comebackLevelR < 1 && regainedR >= ANNOUNCER_THRESHOLDS.comebackNoticeable) { announcer.trigger('comeback_noticeable', { priorityBoost: lateBoost }); comebackLevelR = 1; }
  }

  // Time-based countdown toward tie end
  if (MATCH_LIMIT.enabled && MATCH_LIMIT.ms > 0) {
    const start = (sim as any).matchStart ?? 0;
    const remainingMs = Math.max(0, MATCH_LIMIT.ms - (performance.now() - start));
    const remainingSec = Math.floor(remainingMs / 1000);
    const bothAlive = (cL.centerHP | 0) > 0 && (cR.centerHP | 0) > 0;
    if (bothAlive) {
      if (!countdown10 && ANNOUNCER_THRESHOLDS.countdownSecs.includes(10) && remainingSec <= 10 && remainingSec > 3) {
        announcer.trigger('time_countdown_10');
        countdown10 = true;
      }
      if (!countdown3 && ANNOUNCER_THRESHOLDS.countdownSecs.includes(3) && remainingSec <= 3) {
        announcer.trigger('time_countdown_3');
        countdown3 = true;
      }
    }
  }

  // advance previous frame snapshot
  prevCenterL = (cL.centerHP | 0);
  prevCenterR = (cR.centerHP | 0);

  announcer.run(now);
}

function speakBanter(ev: string, side: 'L' | 'R'): void {
  // fire-and-forget; helper handles LLM/fallback
  void speakBanterSmart(ev as any, side);
}
