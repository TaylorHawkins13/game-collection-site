/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile } from '../engine.ts';
import { createPlan, generateWeek, LADDER, nextStep, runDates, startingStep, walkRunMinutes } from '../plan.ts';
import { adaptAfterFeedback, directiveFor, easeSession } from '../adaptation.ts';
import { buildCues, walkRunPhase } from '../cues.ts';
import type { Activity, ExperienceLevel } from '../types.ts';

const TODAY = '2026-01-05';

function profile(level: ExperienceLevel, frequency: 0 | 1 | 2 | 3 | null = 0, extra = {}) {
  return { ...defaultProfile({ level, frequency, goal: 'habit', issues: [], includeQuality: false }, TODAY), ...extra };
}

test('first weeks match the brief for each starting level', () => {
  const newbie = createPlan(profile('new', 0), TODAY).weeks[0];
  const runs = newbie.sessions.filter((s) => s.kind === 'run');
  assert.equal(runs.length, 3);
  for (const r of runs) {
    assert.equal(r.runType, 'walk_run');
    assert.ok(r.durationMin >= 15 && r.durationMin <= 20, `new: ${r.durationMin}`);
  }
  assert.equal(runs[0].date, TODAY, 'first session is today');

  const ret = createPlan(profile('returning', 1), TODAY).weeks[0].sessions.filter((s) => s.kind === 'run');
  assert.equal(ret.length, 3);
  for (const r of ret) assert.ok(r.durationMin >= 20 && r.durationMin <= 25, `returning: ${r.durationMin}`);

  const cons = createPlan(profile('consistent', null), TODAY).weeks[0].sessions.filter((s) => s.kind === 'run');
  assert.ok(cons.length >= 3 && cons.length <= 4);
  for (const r of cons) assert.ok(r.durationMin >= 25 && r.durationMin <= 40, `consistent: ${r.durationMin}`);

  const exp = createPlan(profile('experienced', null), TODAY).weeks[0];
  assert.equal(exp.sessions.filter((s) => s.kind === 'run').length, 4);
  assert.equal(exp.sessions.filter((s) => s.kind === 'strength').length, 2);
});

test('strength sessions are optional, short and on non-run days', () => {
  const w = createPlan(profile('consistent', null), TODAY).weeks[0];
  const strength = w.sessions.filter((s) => s.kind === 'strength');
  const runDays = w.sessions.filter((s) => s.kind === 'run').map((s) => s.date);
  assert.equal(strength.length, 2);
  for (const s of strength) {
    assert.ok(s.optional);
    assert.ok(s.durationMin >= 8 && s.durationMin <= 15);
    assert.ok(!runDays.includes(s.date));
  }
});

test('experienced quality option adds strides only when chosen', () => {
  const w = generateWeek(profile('experienced', null, { includeQuality: true }), 1, TODAY, 13, 'hold');
  assert.equal(w.sessions.filter((s) => s.runType === 'strides').length, 1);
  const easy = generateWeek(profile('experienced', null), 1, TODAY, 13, 'hold');
  assert.equal(easy.sessions.filter((s) => s.runType === 'strides').length, 0);
});

test('preferred weekdays are honoured', () => {
  const dates = runDates('2026-01-07', 3, [1, 3, 5]); // Wed start; Tue/Thu/Sat
  assert.deepEqual(dates, ['2026-01-08', '2026-01-10', '2026-01-13']);
});

test('ladder walk-run durations stay modest', () => {
  for (const s of LADDER) if (s.walkRun) assert.ok(walkRunMinutes(s.walkRun) <= 35);
  assert.equal(startingStep('new', 0), 0);
});

test('progression moves one step and respects caution + cap', () => {
  assert.deepEqual(nextStep(3, 'progress', { cap: 12, cautious: false, weeksSinceProgress: 0 }), { step: 4, progressed: true });
  assert.deepEqual(nextStep(3, 'progress', { cap: 12, cautious: true, weeksSinceProgress: 0 }), { step: 3, progressed: false });
  assert.deepEqual(nextStep(12, 'progress', { cap: 12, cautious: false, weeksSinceProgress: 3 }), { step: 12, progressed: false });
  assert.deepEqual(nextStep(0, 'ease', { cap: 12, cautious: false, weeksSinceProgress: 0 }), { step: 0, progressed: false });
});

function act(id: string, date: string, feel: Activity['feel'], soreness: Activity['soreness'] = 'none'): Activity {
  return { id, date, startedAt: Date.parse(date), endedAt: Date.parse(date) + 1, kind: 'run', title: 'x', durationSec: 1200, xpEarned: 50, completion: 1, feel, soreness };
}

test('directives: ease on soreness/repeated hard, progress on easy weeks, hold otherwise', () => {
  const base = { completion: 1, completedCount: 3, pausedDays: 0, daysSinceLastActivity: 1 };
  assert.equal(directiveFor({ ...base, feelings: [act('a', TODAY, 'easy', 'noticeable')] }, 1, 3).directive, 'ease');
  assert.equal(directiveFor({ ...base, feelings: [act('a', TODAY, 'hard'), act('b', TODAY, 'hard')] }, 1, 3).directive, 'ease');
  assert.equal(directiveFor({ ...base, feelings: [act('a', TODAY, 'easy'), act('b', TODAY, 'just_right')] }, 1, 3).directive, 'progress');
  assert.equal(directiveFor({ ...base, completion: 0.5, feelings: [] }, 1, 3).directive, 'hold');
  assert.equal(directiveFor({ ...base, completedCount: 0, completion: 0, feelings: [], daysSinceLastActivity: 14 }, 1, 3).directive, 'ease');
  assert.equal(directiveFor({ ...base, feelings: [act('a', TODAY, 'easy')] }, 3, 12).directive, 'recovery');
});

test('noticeable soreness swaps the next run for mobility and eases the rest', () => {
  const p = profile('returning', 2);
  const week = createPlan(p, TODAY).weeks[0];
  const first = week.sessions.find((s) => s.kind === 'run')!;
  const a = { ...act('a1', first.date, 'just_right', 'noticeable') };
  const done = { ...week, sessions: week.sessions.map((s) => (s.id === first.id ? { ...s, status: 'completed' as const } : s)) };
  const r = adaptAfterFeedback(done, a, [a], p);
  assert.ok(r.swapped);
  assert.ok(r.note);
  const swapped = r.week.sessions.find((s) => s.replacedFrom === 'run')!;
  assert.equal(swapped.kind, 'strength');
  assert.equal(swapped.optional, false, 'replacement still counts as a planned session');
  const laterRuns = r.week.sessions.filter((s) => s.kind === 'run' && s.status === 'planned');
  for (const s of laterRuns) assert.ok(s.note?.includes('Eased'));
});

test('easing a walk-run steps back one rung; continuous runs shrink ~20%', () => {
  const p = profile('new', 2);
  const s = createPlan(p, TODAY).weeks[0].sessions[0];
  const eased = easeSession(s);
  assert.equal(eased.step, s.step! - 1);
  const easy = generateWeek(profile('consistent', null), 1, TODAY, 12, 'hold').sessions[0];
  assert.equal(easeSession(easy).durationMin, 25);
});

test('walk-run cues line up with phases', () => {
  const s = createPlan(profile('new', 0), TODAY).weeks[0].sessions[0];
  const cues = buildCues(s, 'new');
  assert.equal(cues[0].atSec, 0);
  assert.ok(cues.some((c) => c.text.startsWith('Run for 30 seconds')));
  assert.equal(cues[cues.length - 1].kind, 'end');
  assert.equal(walkRunPhase(s.walkRun!, 10).phase, 'warmup');
  assert.equal(walkRunPhase(s.walkRun!, 185).phase, 'run');
  assert.equal(walkRunPhase(s.walkRun!, 215).phase, 'walk');
  assert.equal(walkRunPhase(s.walkRun!, 99999).phase, 'done');
});
