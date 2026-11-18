import type { ExperienceLevel, GoalId } from './domain/types';

export interface GoalOption {
  id: GoalId;
  label: string;
  description: string;
  group: 'Just run' | 'Distance goals' | 'Get faster';
  levels?: ExperienceLevel[];
}

const ALL_BUT_NEW: ExperienceLevel[] = ['returning', 'consistent', 'experienced'];
const SEASONED: ExperienceLevel[] = ['consistent', 'experienced'];

export const GOALS: GoalOption[] = [
  { id: 'habit', group: 'Just run', label: 'Build a running habit', description: 'No target — just make it stick.' },
  { id: 'fitness', group: 'Just run', label: 'Get fitter and healthier', description: 'General fitness, steady progress.' },
  { id: 'stress', group: 'Just run', label: 'Clear my head', description: 'Running for headspace. Easy, regular, no numbers.' },
  { id: 'back_to_routine', group: 'Just run', label: 'Get back to my old routine', description: 'Rebuild gradually.', levels: ['returning', 'consistent'] },
  { id: 'run30', group: 'Distance goals', label: 'Run 30 minutes non-stop', description: 'A classic first milestone.', levels: ['new', 'returning'] },
  { id: '5k', group: 'Distance goals', label: 'Run a 5K', description: 'Comfortably, at your own pace.' },
  { id: '10k', group: 'Distance goals', label: 'Run a 10K', description: 'Build the distance steadily.' },
  { id: 'half', group: 'Distance goals', label: 'Run a half marathon', description: 'Longer-term base building.', levels: ALL_BUT_NEW },
  { id: 'marathon', group: 'Distance goals', label: 'Run a marathon', description: 'Long runs build up gradually over many weeks.', levels: SEASONED },
  { id: 'ultra', group: 'Distance goals', label: 'Run an ultra (50K+)', description: 'Longer base runs, long runs measured in hours, back-to-backs.', levels: SEASONED },
  { id: '5k_faster', group: 'Get faster', label: 'Get faster at 5K', description: 'Weekly tempo or interval session at your PB-based paces.', levels: ALL_BUT_NEW },
  { id: '10k_faster', group: 'Get faster', label: 'Get faster at 10K', description: 'Quality sessions plus a steady long run.', levels: ALL_BUT_NEW },
  { id: 'half_faster', group: 'Get faster', label: 'Get faster at the half', description: 'Tempo work and longer long runs.', levels: SEASONED },
];

export function goalLabel(id: GoalId): string {
  return GOALS.find((g) => g.id === id)?.label ?? 'Build a running habit';
}

export function goalsFor(level: ExperienceLevel | null): GoalOption[] {
  return GOALS.filter((g) => !g.levels || (level && g.levels.includes(level)));
}

/** PBs are required where the plan genuinely depends on them. */
export function pbsRequired(level: ExperienceLevel | null, goal: GoalId): boolean {
  return level === 'consistent' || level === 'experienced' || goal.endsWith('_faster');
}
