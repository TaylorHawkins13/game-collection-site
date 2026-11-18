/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSharedRun, friendCode, normaliseCode } from '../social.ts';
import { defaultShareOptions } from '../share.ts';
import type { Activity } from '../types.ts';

const route = Array.from({ length: 600 }, (_, i) => ({ lat: 51.501234 + i * 0.00004, lng: -0.141234 + Math.sin(i / 40) * 0.001, t: i * 1000 }));
const a: Activity = { id: 'a', date: '2026-01-05', startedAt: 0, endedAt: 1, kind: 'run', plannedSessionId: 'x', title: 'Easy run · 30 min', durationSec: 1800, distanceM: 5000, route, xpEarned: 50, completion: 1 };
const ctx = { units: 'km' as const, division: 4, streak: 9, weekDone: 2, weekTotal: 3 };

test('friend codes match the database format', () => {
  for (let i = 0; i < 500; i++) assert.match(friendCode(), /^[A-Z2-9]{6}$/);
  assert.equal(normaliseCode(' ab-c2d3 '), 'ABC2D3');
});

test('posted runs never contain coordinates and honour every toggle', () => {
  const all = buildSharedRun(a, { showDistance: true, showPace: true, showRoute: true, showRank: true, showStreak: true }, ctx, true);
  const json = JSON.stringify(all);
  assert.ok(!json.includes('51.50') && !json.includes('-0.14') && !json.includes('"lat"'), 'no lat/lng anywhere');
  assert.ok(all.route_shape && all.route_shape.length <= 8000);
  for (const pt of all.route_shape!.split(' ')) {
    const [x, y] = pt.split(',').map(Number);
    assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 60, 'shape normalised to the 100×60 box');
  }
  assert.equal(all.pace_sec_per_km, 360);
  assert.equal(all.rank_label, 'Silver II');
  const none = buildSharedRun(a, { showDistance: false, showPace: false, showRoute: false, showRank: false, showStreak: false }, ctx, true);
  assert.deepEqual([none.distance_m, none.pace_sec_per_km, none.route_shape, none.rank_label, none.streak, none.week_done], [null, null, null, null, null, null]);
  assert.equal(buildSharedRun(a, defaultShareOptions('new', true), ctx, true).pace_sec_per_km, null, 'beginners: pace off by default');
});
