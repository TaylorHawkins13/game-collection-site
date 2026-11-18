/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysLeft, inFinalTwoWeeks, nextSeason, seasonFor } from '../season.ts';
import { addDays, diffDays, weekday, weekStartMonday } from '../dates.ts';

test('quarters map to seasons', () => {
  assert.equal(seasonFor('2026-01-01').id, '2026-Q1');
  assert.equal(seasonFor('2026-03-31').id, '2026-Q1');
  assert.equal(seasonFor('2026-04-01').id, '2026-Q2');
  assert.equal(seasonFor('2026-12-31').end, '2026-12-31');
  assert.equal(seasonFor('2026-02-10').end, '2026-03-31');
  assert.equal(seasonFor('2028-02-10').label, 'Q1 2028');
  assert.equal(nextSeason(seasonFor('2026-11-18')).id, '2027-Q1');
});

test('days left and final-two-weeks window', () => {
  assert.equal(daysLeft('2026-03-31'), 0);
  assert.equal(daysLeft('2026-03-18'), 13);
  assert.ok(inFinalTwoWeeks('2026-03-18'));
  assert.ok(!inFinalTwoWeeks('2026-03-17'));
});

test('date math is DST-safe', () => {
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(diffDays('2026-10-24', '2026-10-27'), 3);
  assert.equal(weekday('2026-11-16'), 0); // Monday
  assert.equal(weekStartMonday('2026-11-22'), '2026-11-16');
});
