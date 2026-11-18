/**
 * Short runner-focused strength & mobility routines (8–15 min).
 * Difficulty 1 = gentle/beginner, 3 = harder. Routines are chosen by level and
 * reported issues; a mobility routine can stand in for a run after soreness.
 */
import type { ExperienceLevel, IssueId } from './types.ts';

export interface Exercise {
  name: string;
  /** e.g. "2 × 10 each side" or "40 sec". */
  dose: string;
  cue: string;
}

export interface Routine {
  id: string;
  title: string;
  kind: 'strength' | 'mobility';
  difficulty: 1 | 2 | 3;
  durationMin: number;
  focus: string[];
  helpsWith: IssueId[];
  exercises: Exercise[];
}

export const ROUTINES: Routine[] = [
  {
    id: 'mob-reset',
    title: 'Easy mobility reset',
    kind: 'mobility',
    difficulty: 1,
    durationMin: 10,
    focus: ['hips', 'ankles', 'back'],
    helpsWith: ['hip_back', 'calf_achilles', 'fatigue'],
    exercises: [
      { name: 'Cat–cow', dose: '60 sec', cue: 'Slow, follow your breath.' },
      { name: 'Hip flexor lunge stretch', dose: '45 sec each side', cue: 'Squeeze the glute of the back leg.' },
      { name: 'Ankle circles + knee-to-wall', dose: '10 each side', cue: 'Heel stays down.' },
      { name: '90/90 hip switches', dose: '10 total', cue: 'Tall chest, move slowly.' },
      { name: 'Calf stretch on a step', dose: '45 sec each side', cue: 'Gentle — no bouncing.' },
      { name: "Child's pose", dose: '60 sec', cue: 'Let your hips sink back.' },
    ],
  },
  {
    id: 'str-foundation',
    title: 'Runner foundations',
    kind: 'strength',
    difficulty: 1,
    durationMin: 10,
    focus: ['glutes', 'core', 'ankles'],
    helpsWith: ['knee', 'hip_back'],
    exercises: [
      { name: 'Glute bridge', dose: '2 × 12', cue: 'Push through heels, ribs down.' },
      { name: 'Clamshell', dose: '2 × 12 each side', cue: 'Keep hips stacked.' },
      { name: 'Bodyweight squat to chair', dose: '2 × 10', cue: 'Knees track over toes.' },
      { name: 'Dead bug', dose: '2 × 8 each side', cue: 'Low back stays on the floor.' },
      { name: 'Calf raises', dose: '2 × 15', cue: 'Slow on the way down.' },
    ],
  },
  {
    id: 'str-shin-calf',
    title: 'Lower-leg resilience',
    kind: 'strength',
    difficulty: 1,
    durationMin: 9,
    focus: ['calves', 'shins', 'feet'],
    helpsWith: ['shin', 'calf_achilles'],
    exercises: [
      { name: 'Slow calf raises', dose: '2 × 12', cue: '3 seconds down.' },
      { name: 'Toe raises (tibialis)', dose: '2 × 15', cue: 'Back against a wall, lift toes.' },
      { name: 'Single-leg balance', dose: '30 sec each side', cue: 'Soft knee, steady hips.' },
      { name: 'Bent-knee calf raises', dose: '2 × 12', cue: 'Targets the soleus.' },
      { name: 'Towel scrunches', dose: '60 sec each foot', cue: 'Wake up the foot muscles.' },
    ],
  },
  {
    id: 'str-hips-core',
    title: 'Hips & core',
    kind: 'strength',
    difficulty: 2,
    durationMin: 12,
    focus: ['glutes', 'hips', 'core'],
    helpsWith: ['knee', 'hip_back'],
    exercises: [
      { name: 'Single-leg glute bridge', dose: '2 × 10 each side', cue: 'Hips level.' },
      { name: 'Side plank', dose: '2 × 25 sec each side', cue: 'Straight line head to heel.' },
      { name: 'Reverse lunge', dose: '2 × 8 each side', cue: 'Front knee stays steady.' },
      { name: 'Bird dog', dose: '2 × 8 each side', cue: 'Reach long, no rotation.' },
      { name: 'Lateral band walk (or no band)', dose: '2 × 12 steps each way', cue: 'Stay low.' },
      { name: 'Single-leg calf raise', dose: '2 × 10 each side', cue: 'Hold a wall for balance.' },
    ],
  },
  {
    id: 'str-strong-legs',
    title: 'Strong legs',
    kind: 'strength',
    difficulty: 3,
    durationMin: 15,
    focus: ['glutes', 'quads', 'calves', 'core'],
    helpsWith: [],
    exercises: [
      { name: 'Bulgarian split squat', dose: '3 × 8 each side', cue: 'Controlled, upright torso.' },
      { name: 'Single-leg Romanian deadlift', dose: '3 × 8 each side', cue: 'Hinge at the hip.' },
      { name: 'Step-ups', dose: '2 × 10 each side', cue: 'Drive through the whole foot.' },
      { name: 'Side plank with leg lift', dose: '2 × 20 sec each side', cue: 'Hips high.' },
      { name: 'Pogo hops', dose: '3 × 20', cue: 'Quick, quiet, springy.' },
      { name: 'Single-leg calf raise', dose: '3 × 12 each side', cue: 'Full range.' },
    ],
  },
  {
    id: 'mob-post-run',
    title: 'Post-run mobility',
    kind: 'mobility',
    difficulty: 2,
    durationMin: 8,
    focus: ['hips', 'hamstrings', 'calves'],
    helpsWith: ['hip_back', 'calf_achilles', 'knee'],
    exercises: [
      { name: 'Leg swings', dose: '10 each direction, each leg', cue: 'Relaxed and loose.' },
      { name: 'World’s greatest stretch', dose: '5 each side', cue: 'Rotate through your upper back.' },
      { name: 'Hamstring floss', dose: '10 each side', cue: 'Never force the range.' },
      { name: 'Figure-4 stretch', dose: '45 sec each side', cue: 'Breathe into the hip.' },
      { name: 'Downward dog calf pedal', dose: '45 sec', cue: 'Alternate heels down.' },
    ],
  },
];

export function routineById(id: string | undefined): Routine | undefined {
  return ROUTINES.find((r) => r.id === id);
}

const MAX_DIFFICULTY: Record<ExperienceLevel, 1 | 2 | 3> = {
  new: 1,
  returning: 2,
  consistent: 2,
  experienced: 3,
};

/**
 * Pick routines for a week. Issues pull in routines that help with them; the
 * week index rotates through the rest so things stay fresh.
 */
export function pickRoutines(level: ExperienceLevel, issues: IssueId[], count: number, weekIndex: number): Routine[] {
  const max = MAX_DIFFICULTY[level];
  const eligible = ROUTINES.filter((r) => r.difficulty <= max);
  const scored = eligible
    .map((r, i) => ({
      r,
      score:
        r.helpsWith.filter((h) => issues.includes(h)).length * 10 +
        r.difficulty * 2 +
        ((i + weekIndex) % eligible.length) / eligible.length,
    }))
    .sort((a, b) => b.score - a.score);
  const out: Routine[] = [];
  // Rotate the start so consecutive weeks differ, but keep issue-relevant ones on top.
  const rotated = issues.length ? scored : [...scored.slice(weekIndex % scored.length), ...scored.slice(0, weekIndex % scored.length)];
  for (const { r } of rotated) {
    if (out.length >= count) break;
    // Mix one strength and one mobility where possible.
    if (out.length === 1 && out[0].kind === r.kind && rotated.some((x) => x.r.kind !== out[0].kind)) continue;
    out.push(r);
  }
  return out;
}

export function mobilityFallback(issues: IssueId[]): Routine {
  if (issues.includes('shin') || issues.includes('calf_achilles')) return routineById('str-shin-calf')!;
  return routineById('mob-reset')!;
}
