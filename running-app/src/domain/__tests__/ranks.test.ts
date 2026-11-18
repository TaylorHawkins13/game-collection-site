/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addXp,
  applyDecay,
  decayFloor,
  divisionLabel,
  GOLD_I,
  isGated,
  MAX_DIVISION,
  newRankState,
  reevaluate,
  softResetDivision,
  xpToClear,
} from '../ranks.ts';

const good = { completion28: 1, activeWeeks4: 4 };
const poor = { completion28: 0.4, activeWeeks4: 2 };

test('labels cover every division with Grandmaster single-tier', () => {
  assert.equal(divisionLabel(0), 'Bronze I');
  assert.equal(divisionLabel(2), 'Bronze III');
  assert.equal(divisionLabel(3), 'Silver I');
  assert.equal(divisionLabel(GOLD_I), 'Gold I');
  assert.equal(divisionLabel(17), 'Master III');
  assert.equal(divisionLabel(MAX_DIVISION), 'Grandmaster');
});

test('XP scaling per tier increases with rank', () => {
  assert.equal(xpToClear(0), 300);
  assert.equal(xpToClear(3), 450);
  assert.equal(xpToClear(6), 700);
  assert.equal(xpToClear(9), 1000);
  assert.equal(xpToClear(12), 1400);
  assert.equal(xpToClear(15), 1900);
  assert.equal(xpToClear(18), 2500);
});

test('Bronze/Silver promotions need XP only', () => {
  let s = newRankState('2026-Q1');
  const r = addXp(s, 310, poor);
  assert.equal(r.state.division, 1);
  assert.equal(r.state.xp, 10);
  assert.deepEqual(r.events, [{ type: 'promoted', division: 1 }]);
  s = { ...r.state, division: 4, xp: 440 };
  assert.equal(addXp(s, 20, poor).state.division, 5); // Silver II → III ignores consistency
});

test('gold gate holds promotion and banks XP until consistency improves', () => {
  const s = { ...newRankState('2026-Q1', GOLD_I), xp: 650 };
  const r = addXp(s, 200, poor);
  assert.equal(r.state.division, GOLD_I);
  assert.equal(r.state.xp, 700);
  assert.equal(r.state.bankedXp, 150);
  assert.equal(r.events[0].type, 'gated');
  assert.ok(isGated(r.state));
  // Gate event is not repeated on the next session.
  assert.equal(addXp(r.state, 50, poor).events.length, 0);
  const after = reevaluate(r.state, good);
  assert.equal(after.state.division, GOLD_I + 1);
  assert.equal(after.state.xp, 150);
  assert.equal(after.state.bankedXp, 0);
});

test('entering Gold itself is gated', () => {
  const s = { ...newRankState('2026-Q1', 5), xp: 440 };
  const r = addXp(s, 50, poor);
  assert.equal(r.state.division, 5);
  assert.equal(r.events[0].type, 'gated');
});

test('decay never applies below Gold or in the final two weeks or when paused', () => {
  const silver = { ...newRankState('2026-Q1', 4), xp: 100 };
  assert.equal(applyDecay(silver, 0, { finalTwoWeeks: false, paused: false }).xpLost, 0);
  const gold = { ...newRankState('2026-Q1', 7), xp: 300 };
  assert.equal(applyDecay(gold, 0, { finalTwoWeeks: true, paused: false }).xpLost, 0);
  assert.equal(applyDecay(gold, 0, { finalTwoWeeks: false, paused: true }).xpLost, 0);
  assert.equal(applyDecay(gold, 0.6, { finalTwoWeeks: false, paused: false }).xpLost, 0);
});

test('decay is gentle and capped one major rank below season start (never out of Gold)', () => {
  const plat = { ...newRankState('2026-Q1', 9), division: 9, xp: 500 };
  const d = applyDecay(plat, 0.3, { finalTwoWeeks: false, paused: false });
  assert.equal(d.xpLost, 100); // 10% of a Platinum tier
  assert.equal(d.state.xp, 400);
  const empty = { ...plat, xp: 0 };
  const dropped = applyDecay(empty, 0, { finalTwoWeeks: false, paused: false });
  assert.ok(dropped.demoted);
  assert.equal(dropped.state.division, 8);
  assert.equal(dropped.state.xp, 420); // 60% of Gold tier
  // Season started Platinum I (9) → floor is Gold I (6).
  assert.equal(decayFloor(9), 6);
  const atFloor = { ...newRankState('2026-Q1', 9), division: 6, xp: 0 };
  const stuck = applyDecay(atFloor, 0, { finalTwoWeeks: false, paused: false });
  assert.equal(stuck.state.division, 6);
  // Started Diamond II → floor Platinum I.
  assert.equal(decayFloor(13), 9);
});

test('soft reset drops roughly one major rank', () => {
  const normal = { completion: 0.7, sessions: 30, activeWeeksLast4: 4 };
  assert.equal(softResetDivision(7, normal), 4); // Gold II → Silver II
  assert.equal(softResetDivision(9, normal), 6); // Platinum I → Gold I
  const great = { completion: 0.9, sessions: 40, activeWeeksLast4: 4 };
  assert.equal(softResetDivision(9, great), 7); // highly consistent → slightly higher
  assert.equal(softResetDivision(9, { completion: 0.1, sessions: 2, activeWeeksLast4: 0 }), 0);
  assert.equal(softResetDivision(1, normal), 0);
  assert.equal(softResetDivision(MAX_DIVISION, normal), 15);
});

test('Grandmaster accumulates XP without promoting further', () => {
  const gm = { ...newRankState('2026-Q1', MAX_DIVISION) };
  const r = addXp(gm, 3000, good);
  assert.equal(r.state.division, MAX_DIVISION);
  assert.equal(r.state.xp, 3000);
});
