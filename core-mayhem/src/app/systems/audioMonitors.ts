import { audio } from '../../audio';
import { AUDIO_DEFAULTS } from '../../audio/config';
import { sim } from '../../state';

const alarmIdL = 'alarm_L';
const alarmIdR = 'alarm_R';

export function runAudioMonitors(): void {
  // Low-HP alarm per core side
  const thr = Math.max(0, Math.min(1, (AUDIO_DEFAULTS as any).lowHPThresholdPct ?? 0.15));
  const on = (core: any): boolean => {
    const hp = Number(core?.centerHP ?? 0);
    const max = Number(core?.centerHPmax ?? 0) || 1;
    return hp > 0 && hp / max <= thr;
  };
  if (on((sim as any).coreL)) audio.startLoop(alarmIdL, 'core_low_hp_alarm', 0.35);
  else audio.stopLoop(alarmIdL);
  if (on((sim as any).coreR)) audio.startLoop(alarmIdR, 'core_low_hp_alarm', 0.35);
  else audio.stopLoop(alarmIdR);
}

