/**
 * Permanent badges. All about showing up and looking after yourself — no
 * speed, distance or PR badges in the core experience.
 */
import { diffDays } from './dates.ts';
import { countsTowardCompletion, planStreak } from './metrics.ts';
import { GOLD_I } from './ranks.ts';
import type { AppState, DateKey } from './types.ts';

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji keeps the MVP asset-free
  earned: (s: AppState, today: DateKey) => boolean;
}

function weekCore(s: AppState) {
  return (s.plan?.weeks ?? []).map((w) => w.sessions.filter(countsTowardCompletion));
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first_session',
    title: 'First Session',
    description: 'Completed your first session. The hardest one.',
    icon: '👟',
    earned: (s) => s.activities.length > 0,
  },
  {
    id: 'week1_complete',
    title: 'Week 1 Complete',
    description: 'Finished every planned session in your first week.',
    icon: '🌱',
    earned: (s) => {
      const w = weekCore(s)[0];
      return !!w && w.length > 0 && w.every((x) => x.status === 'completed');
    },
  },
  {
    id: 'three_session_week',
    title: '3-Session Week',
    description: 'Completed 3 planned sessions in one week.',
    icon: '🔁',
    earned: (s) => (s.plan?.weeks ?? []).some((w) => w.sessions.filter((x) => x.status === 'completed').length >= 3),
  },
  {
    id: 'easy_effort',
    title: 'Easy Effort',
    description: 'Logged 5 sessions as Easy or Just right. That’s the sweet spot.',
    icon: '😌',
    earned: (s) => s.activities.filter((a) => a.feel === 'easy' || a.feel === 'just_right').length >= 5,
  },
  {
    id: 'recovery_aware',
    title: 'Recovery Aware',
    description: 'Listened to your body: took a recovery swap or logged 3 rest days.',
    icon: '🛌',
    earned: (s) =>
      s.restClaims.length >= 3 ||
      (s.plan?.weeks ?? []).some((w) => w.sessions.some((x) => x.replacedFrom === 'run' && x.status === 'completed')),
  },
  {
    id: 'health_connected',
    title: 'Health Connected',
    description: 'Connected Apple Health or Health Connect.',
    icon: '❤️',
    earned: (s) => s.health.connected,
  },
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'Seven days in a row of sticking to your plan — rest days included.',
    icon: '🔥',
    earned: (s, today) => planStreak(s, today) >= 7 && s.activities.length >= 2,
  },
  {
    id: 'strength_starter',
    title: 'Strength Starter',
    description: 'Completed your first strength or mobility session.',
    icon: '💪',
    earned: (s) => s.activities.some((a) => a.kind === 'strength'),
  },
  {
    id: 'comeback',
    title: 'Comeback',
    description: 'Came back after 10+ days away. Restarting is a skill.',
    icon: '🌅',
    earned: (s) => {
      const dates = [...new Set(s.activities.map((a) => a.date))].sort();
      return dates.some((d, i) => i > 0 && diffDays(dates[i - 1], d) >= 10);
    },
  },
  {
    id: 'four_steady_weeks',
    title: 'Four Steady Weeks',
    description: 'Hit your weekly target four weeks in a row.',
    icon: '📅',
    earned: (s) => {
      const starts = (s.plan?.weeks ?? []).map((w) => w.start);
      let run = 0;
      for (const st of starts) {
        run = s.weeklyTargetPaid.includes(st) ? run + 1 : 0;
        if (run >= 4) return true;
      }
      return false;
    },
  },
  {
    id: 'reached_gold',
    title: 'Gold Standard',
    description: 'Reached Gold in any season.',
    icon: '🥇',
    earned: (s) => s.peakDivisionEver >= GOLD_I,
  },
  {
    id: 'season_finisher',
    title: 'Season Finisher',
    description: 'Was active through the end of a season.',
    icon: '🏁',
    earned: (s) => s.seasonFinishes.some((f) => f.sessions > 0),
  },
];

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/** Returns ids of newly earned badges. */
export function newlyEarned(s: AppState, today: DateKey): string[] {
  return BADGES.filter((b) => !s.badges[b.id] && b.earned(s, today)).map((b) => b.id);
}
