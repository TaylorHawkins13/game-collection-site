/**
 * Weekly challenges: small, achievable, consistency-flavoured. Never about
 * pace or distance.
 */
import type { Activity, DateKey, PlanWeek } from './types.ts';

export interface ChallengeDef {
  id: string;
  title: string;
  description: string;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'feedback_every', title: 'Check in every time', description: 'Log how each session felt this week (at least 2).' },
  { id: 'all_planned', title: 'Full week', description: 'Complete every planned run this week.' },
  { id: 'one_strength', title: 'Strong foundations', description: 'Do one strength or mobility session.' },
  { id: 'easy_logs', title: 'Keep it conversational', description: 'Log 3 sessions as “Easy” or “Just right”.' },
  { id: 'rest_respect', title: 'Rest is training', description: 'Take (and log) 2 planned rest days.' },
  { id: 'start_strong', title: 'Start strong', description: 'Complete the first session of the week on its planned day.' },
];

export function challengeById(id: string): ChallengeDef {
  return CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0];
}

export function pickChallenge(weekIndex: number, hasStrength: boolean): string {
  if (weekIndex === 0) return 'feedback_every';
  const pool = CHALLENGES.filter((c) => hasStrength || c.id !== 'one_strength');
  return pool[weekIndex % pool.length].id;
}

export interface ChallengeProgress {
  current: number;
  target: number;
  done: boolean;
}

export function challengeProgress(week: PlanWeek, activities: Activity[], restClaims: DateKey[]): ChallengeProgress {
  const inWeek = activities.filter((a) => a.date >= week.start && a.date <= week.end);
  const coreRuns = week.sessions.filter((s) => s.kind === 'run' && !s.optional && s.status !== 'dropped' && s.status !== 'paused');
  const p = (current: number, target: number) => ({ current: Math.min(current, target), target, done: current >= target });
  switch (week.challengeId) {
    case 'feedback_every': {
      const withFeedback = inWeek.filter((a) => a.feel).length;
      const target = Math.max(2, inWeek.length);
      return p(withFeedback, target);
    }
    case 'all_planned': {
      const done = coreRuns.filter((s) => s.status === 'completed').length;
      return p(done, Math.max(1, coreRuns.length));
    }
    case 'one_strength':
      return p(inWeek.filter((a) => a.kind === 'strength').length, 1);
    case 'easy_logs':
      return p(inWeek.filter((a) => a.feel === 'easy' || a.feel === 'just_right').length, 3);
    case 'rest_respect':
      return p(restClaims.filter((d) => d >= week.start && d <= week.end).length, 2);
    case 'start_strong': {
      const first = week.sessions.find((s) => !s.optional && s.status !== 'dropped' && s.status !== 'paused');
      const ok = !!first && first.status === 'completed' && inWeek.some((a) => a.id === first.activityId && a.date === first.date);
      return p(ok ? 1 : 0, 1);
    }
    default:
      return p(0, 1);
  }
}
