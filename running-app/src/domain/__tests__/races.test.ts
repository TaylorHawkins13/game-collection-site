/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeSession, createInitialState, onboard, removeRace, saveRace, tick, updateProfile } from '../engine.ts';
import { addDays, weekday } from '../dates.ts';
import { allSessions, currentWeek, generateWeek, templateFromWeek } from '../plan.ts';
import { applyRaceDays, phaseFor, raceWeekPlan, recoveryDays, taperDays } from '../races.ts';
import { searchCatalog } from '../raceCatalog.ts';
import type { AppState, Race } from '../types.ts';

const START = '2026-01-05';

function runner(level: 'consistent' | 'new' = 'consistent'): AppState {
  return onboard(
    createInitialState(START),
    { level, frequency: level === 'new' ? 0 : null, goal: 'habit', issues: [], includeQuality: false, pbs: level === 'new' ? [] : [{ distance: '5k', timeSec: 1500, recency: 'recent' }] },
    START,
  );
}

const race = (over: Partial<Race> = {}): Race => ({ id: 'r1', name: 'Test Half', date: '2026-04-19', distanceM: 21097.5, terrain: 'road', pbAttempt: true, ...over });

test('phases count down to race day', () => {
  const r = race();
  assert.equal(phaseFor(r, '2026-01-05'), 'base'); // 15 weeks out
  assert.equal(phaseFor(r, '2026-02-09'), 'build'); // 10 weeks
  assert.equal(phaseFor(r, '2026-03-23'), 'peak'); // 4 weeks
  assert.equal(phaseFor(r, '2026-04-06'), 'taper'); // 13 days out, 10-day taper
  assert.equal(phaseFor(r, '2026-04-13'), 'race_week');
  assert.equal(taperDays(race({ distanceM: 42195 })), 14);
  assert.equal(taperDays(race({ distanceM: 5000 })), 7);
});

test('recovery scales with distance, terrain and intent', () => {
  assert.equal(recoveryDays(race({ distanceM: 42195 })), 14);
  assert.equal(recoveryDays(race({ distanceM: 21097.5, terrain: 'trail' })), 9);
  assert.equal(recoveryDays(race({ distanceM: 5000, pbAttempt: false })), 1);
});

test('PB-attempt build adds a race-pace workout and grows the long run; taper cuts volume', () => {
  const p = runner().profile!;
  const build = generateWeek(p, 6, '2026-02-09', 13, 'hold', 1500, [race()]);
  const tempo = build.sessions.find((s) => s.workout)!;
  assert.equal(tempo.runType, 'tempo');
  assert.match(tempo.title, /Half-pace/);
  assert.ok(tempo.targetPaceSecPerKm! > 300 && tempo.targetPaceSecPerKm! < 340, `half pace ${tempo.targetPaceSecPerKm}`);
  const normal = generateWeek(p, 6, '2026-02-09', 13, 'hold', 1500, []);
  const longB = build.sessions.find((s) => s.runType === 'long')!.durationMin;
  const longN = normal.sessions.find((s) => s.runType === 'long')!.durationMin;
  assert.ok(longB > longN, `long ${longB} > ${longN}`);
  assert.ok(build.phaseNote?.startsWith('Build phase'));
  const taper = generateWeek(p, 13, '2026-04-06', 13, 'hold', 1500, [race()]);
  const vol = (w: typeof taper) => w.sessions.filter((s) => s.kind === 'run').reduce((a, s) => a + s.durationMin, 0);
  assert.ok(vol(taper) < vol(normal) * 0.85);
  // Trail races swap in hills.
  const trail = generateWeek(p, 6, '2026-02-09', 13, 'hold', 1500, [race({ terrain: 'trail' })]);
  assert.equal(trail.sessions.find((s) => s.workout)?.runType, 'hills');
  // Fun races don't change normal weeks.
  assert.equal(raceWeekPlan([race({ pbAttempt: false })], '2026-02-09', 'consistent', 1500).race, undefined);
});

test('race week: race on the day, rest the day before (PB), short runs before, recovery after', () => {
  const p = runner().profile!;
  const r = race({ date: '2026-04-19' }); // Sunday
  const wk = generateWeek(p, 14, '2026-04-13', 13, 'hold', 1500, [r]);
  const raceDay = wk.sessions.find((s) => s.runType === 'race')!;
  assert.equal(raceDay.date, '2026-04-19');
  assert.ok(raceDay.targetPaceSecPerKm);
  assert.equal(wk.sessions.filter((s) => s.date === '2026-04-18').length, 0, 'rest the day before');
  for (const s of wk.sessions.filter((x) => x.kind === 'run' && x.date >= '2026-04-16' && x.date < '2026-04-19')) assert.equal(s.runType, 'easy');
  const after = applyRaceDays(generateWeek(p, 15, '2026-04-20', 13, 'hold', 1500, []).sessions, [r], '2026-04-20', '2026-04-26', 1500);
  assert.ok(after.every((s) => s.kind !== 'run' || (s.runType === 'easy' || s.runType === 'long') && !s.workout), 'no workouts in recovery');
  assert.ok(!after.some((s) => s.date <= '2026-04-21' && s.kind === 'run'), 'first recovery days are rest');
});

test('adding and removing a race rebuilds the current week; finishing it records a result', () => {
  let s = runner();
  const r = race({ id: 'fun', name: 'parkrun', date: addDays(START, 5), distanceM: 5000, pbAttempt: false });
  s = saveRace(s, r, START);
  const raceSession = currentWeek(s.plan!, START)!.sessions.find((x) => x.raceId === 'fun')!;
  assert.ok(raceSession);
  const done = completeSession(s, { plannedSessionId: raceSession.id, kind: 'run', title: 'parkrun', startedAt: 0, endedAt: 1, durationSec: 1480, distanceM: 5000 }, raceSession.date);
  assert.equal(done.state.races![0].result!.timeSec, 1480);
  assert.ok(done.state.badges.race_day);
  assert.ok(done.events.some((e) => e.type === 'possible_pb'));
  const removed = removeRace(s, 'fun', START);
  assert.ok(!currentWeek(removed.plan!, START)!.sessions.some((x) => x.raceId));
});

test('custom plan: user template drives the weeks, races still slot in, no auto-progression', () => {
  let s = runner();
  const template = [
    { weekday: 1, kind: 'run' as const, runType: 'easy' as const, durationMin: 30 },
    { weekday: 3, kind: 'run' as const, runType: 'intervals' as const, durationMin: 40 },
    { weekday: 5, kind: 'run' as const, runType: 'long' as const, durationMin: 70 },
    { weekday: 6, kind: 'strength' as const, durationMin: 10, optional: true },
  ];
  s = updateProfile(s, { planMode: 'custom', customWeek: template }, START);
  const step = s.plan!.step;
  s = tick(s, addDays(START, 7)).state;
  const w = s.plan!.weeks[1];
  assert.equal(s.plan!.step, step);
  assert.equal(w.sessions.length, 4);
  assert.deepEqual(w.sessions.map((x) => weekday(x.date)).sort(), [1, 3, 5, 6]);
  assert.ok(w.sessions.find((x) => x.runType === 'intervals')?.targetPaceSecPerKm, 'uses PB paces');
  assert.equal(w.sessions.find((x) => x.runType === 'long')?.durationMin, 70);
  s = saveRace(s, race({ id: 'c', date: addDays(START, 13), distanceM: 10000 }), addDays(START, 7));
  assert.ok(allSessions(s.plan).some((x) => x.raceId === 'c'));
  assert.ok(templateFromWeek(runner().plan!.weeks[0]).length > 0);
});

test('race catalog search', () => {
  assert.ok(searchCatalog('london').some((r) => r.id === 'london-marathon'));
  assert.ok(searchCatalog('').length >= 25);
  assert.equal(searchCatalog('zzzz').length, 0);
});

import { defaultShareOptions, routePolyline, shareText } from '../share.ts';

test('share text leads with consistency and respects choices', () => {
  const a = { id: 'a', date: '2026-01-05', startedAt: 0, endedAt: 1, kind: 'run' as const, plannedSessionId: 'x', title: 'Easy run · 30 min', durationSec: 1800, distanceM: 5000, xpEarned: 50, completion: 1 };
  const ctx = { units: 'km' as const, division: 4, streak: 9, weekDone: 2, weekTotal: 3 };
  const beginner = defaultShareOptions('new', false);
  assert.equal(beginner.showPace, false, 'pace hidden by default for newer runners');
  const t = shareText(a, beginner, ctx);
  assert.match(t, /Planned run: done/);
  assert.match(t, /9-day plan streak/);
  assert.match(t, /2\/3 sessions this week/);
  assert.match(t, /Silver II/);
  assert.doesNotMatch(t, /⚡/);
  assert.match(shareText(a, { ...beginner, showPace: true }, ctx), /⚡ 6:00 \/km/);
  assert.doesNotMatch(shareText(a, { ...beginner, showRank: false, showStreak: false }, ctx), /Silver|streak/);
});

test('route polyline is trimmed and fits the box', () => {
  const route = Array.from({ length: 300 }, (_, i) => ({ lat: 51.5 + i * 0.00005, lng: -0.1 + Math.sin(i / 30) * 0.001, t: i * 1000 }));
  const pts = routePolyline(route, 300, 200)!.split(' ').map((p) => p.split(',').map(Number));
  assert.ok(pts.length > 10);
  for (const [x, y] of pts) assert.ok(x >= 0 && x <= 300 && y >= 0 && y <= 200);
  assert.equal(routePolyline(route.slice(0, 5), 300, 200), null, 'too short to show safely');
});
