/**
 * iOS Live Activity on the lock screen + Dynamic Island. The interval countdown
 * is a native timer (progressBar.date), so it keeps ticking with zero JS work;
 * we only push updates every ~10 s or when the interval changes.
 */
import * as LiveActivity from 'expo-live-activity';
import type { LiveStatus } from '../domain/liveStatus';

let id: string | null = null;
let lastSent = 0;
let lastPhaseEnd: number | undefined;

const config: LiveActivity.LiveActivityConfig = {
  backgroundColor: '#0F1D17',
  titleColor: '#FFFFFF',
  subtitleColor: '#CFE7DC',
  progressViewTint: '#5CC09A',
  progressViewLabelColor: '#FFFFFF',
  timerType: 'digital',
  deepLinkUrl: 'steady://',
};

function toState(s: LiveStatus): LiveActivity.LiveActivityState {
  return {
    title: s.title,
    subtitle: s.subtitle,
    progressBar: s.phaseEndsAt ? { date: s.phaseEndsAt } : s.progress !== undefined ? { progress: s.progress } : undefined,
  };
}

export const liveStats = {
  supported: true,
  start(s: LiveStatus) {
    try {
      id = (LiveActivity.startActivity(toState(s), config) as string | undefined) ?? null;
      lastSent = Date.now();
      lastPhaseEnd = s.phaseEndsAt;
    } catch {
      id = null; // iOS < 16.2 or Live Activities turned off for the app
    }
  },
  update(s: LiveStatus) {
    if (!id) return;
    const phaseChanged = s.phaseEndsAt !== undefined && Math.abs((s.phaseEndsAt ?? 0) - (lastPhaseEnd ?? 0)) > 2000;
    if (!phaseChanged && Date.now() - lastSent < 10_000) return;
    try {
      LiveActivity.updateActivity(id, toState(s));
      lastSent = Date.now();
      lastPhaseEnd = s.phaseEndsAt;
    } catch {
      // ignore: the user may have dismissed it
    }
  },
  end(s?: LiveStatus) {
    if (!id) return;
    try {
      LiveActivity.stopActivity(id, toState(s ?? { title: 'Run saved', subtitle: 'Nice work showing up.' }));
    } catch {
      // already gone
    }
    id = null;
  },
};
