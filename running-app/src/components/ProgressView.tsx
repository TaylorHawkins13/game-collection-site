/** Progress: rank & season, peak rank, consistency calendar, season stats, badges, lifetime. No leaderboard. */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { ConsistencyCalendar, seasonCalendarRange } from './ConsistencyCalendar';
import { RankEmblem } from './RankEmblem';
import { Body, Button, Card, H2, H3, ProgressBar, Row, Screen, SectionTitle, Small, Stat, StatRow } from './ui';
import { BADGES } from '../domain/badges';
import { formatShort } from '../domain/dates';
import { lifetimeStats, seasonStats } from '../domain/engine';
import { formatDistance, formatDuration } from '../domain/gps';
import { planStreak } from '../domain/metrics';
import { divisionLabel, divisionProgress, gateFor, GOLD_I, isGated, MAX_DIVISION, RANK_NAMES, rankOf, XP_PER_TIER, xpToClear } from '../domain/ranks';
import { inFinalTwoWeeks } from '../domain/season';
import { today as getToday, useStore } from '../state/store';
import { RANK_COLORS, space, useColors } from '../theme';

export function ProgressView({ header }: { header: ReactNode }) {
  const c = useColors();
  const app = useStore((s) => s.app);
  const [showLadder, setShowLadder] = useState(false);
  const today = getToday();
  const rank = app.rank;
  const stats = seasonStats(app, today);
  const life = lifetimeStats(app);
  const streak = planStreak(app, today);
  const { from, to } = seasonCalendarRange(stats.season.start, today, app.plan?.startDate);
  const units = app.profile?.units ?? 'km';
  const gate = gateFor(rank.division + 1);

  return (
    <Screen>
      {header}

      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
        <RankEmblem division={rank.division} size={88} />
        <H2>{divisionLabel(rank.division)}</H2>
        <View style={{ alignSelf: 'stretch', gap: 6 }}>
          <ProgressBar value={divisionProgress(rank)} color={RANK_COLORS[rankOf(rank.division)]} height={12} />
          <Small style={{ textAlign: 'center' }}>
            {rank.division >= MAX_DIVISION
              ? `${rank.xp} Grandmaster XP`
              : isGated(rank) && gate
                ? `Ready to promote once 4-week plan completion ≥ ${Math.round(gate.minCompletion * 100)}% across ${gate.minActiveWeeks} active weeks`
                : `${rank.xp} / ${xpToClear(rank.division)} XP · next: ${divisionLabel(rank.division + 1)}`}
          </Small>
        </View>
        <Small>
          {stats.season.name} ({stats.season.label}) · {stats.daysLeft} days left
        </Small>
        <Small>Peak rank ever: {divisionLabel(app.peakDivisionEver)}</Small>
      </Card>

      <Card>
        <H3>Season so far</H3>
        <StatRow>
          <Stat label="Sessions" value={String(stats.sessions)} />
          <Stat label="Plan completion" value={`${Math.round(stats.completion * 100)}%`} />
          <Stat label="Season XP" value={String(stats.xp)} />
        </StatRow>
        <Small>
          {stats.completionDone} of {stats.completionDue} planned sessions done so far · plan streak {streak} day{streak === 1 ? '' : 's'}
        </Small>
      </Card>

      <Card>
        <H3>Consistency</H3>
        <ConsistencyCalendar state={app} from={from} to={to} today={today} />
      </Card>

      <Card style={{ backgroundColor: c.surfaceAlt }}>
        <H3>How ranks work</H3>
        <Small>
          Earn XP by completing planned sessions — not by going further or faster. Bronze and Silver never drop. From Gold up, promotions also need steady plan completion, and a
          very quiet two weeks can dip your progress a little (never more than one rank below where you started the season, and never in the last two weeks).
          {rank.division >= GOLD_I && inFinalTwoWeeks(today) ? ' Rank protection is on: final two weeks of the season.' : ''}
        </Small>
        <Small>Pausing your plan (sick, travel, busy) freezes all of this.</Small>
        <Button kind="ghost" title={showLadder ? 'Hide rank ladder' : 'Show rank ladder'} onPress={() => setShowLadder(!showLadder)} />
        {showLadder
          ? RANK_NAMES.map((r) => (
              <Row key={r} style={{ justifyContent: 'space-between' }}>
                <Row>
                  <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: RANK_COLORS[r] }} />
                  <Body>{r === 'Grandmaster' ? r : `${r} I–III`}</Body>
                </Row>
                <Small>
                  {XP_PER_TIER[r]} XP/tier{gateFor(RANK_NAMES.indexOf(r) * 3) ? ` · ${Math.round(gateFor(RANK_NAMES.indexOf(r) * 3)!.minCompletion * 100)}% gate` : ''}
                </Small>
              </Row>
            ))
          : null}
      </Card>

      <SectionTitle>Badges</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg }}>
          {BADGES.map((b) => {
            const earned = app.badges[b.id];
            return (
              <View
                key={b.id}
                accessible
                accessibilityLabel={`${b.title}: ${earned ? 'earned' : 'not yet'}. ${b.description}`}
                style={{ width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: earned ? c.primarySoft : c.surfaceAlt,
                    borderWidth: 2,
                    borderColor: earned ? c.primary : c.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: earned ? 1 : 0.5,
                  }}
                >
                  <Body style={{ fontSize: 26 }}>{earned ? b.icon : '🔒'}</Body>
                </View>
                <Small muted={!earned} style={{ fontWeight: '600', textAlign: 'center' }}>
                  {b.title}
                </Small>
                <Small style={{ textAlign: 'center', fontSize: 11 }}>{earned ? formatShort(earned) : b.description}</Small>
              </View>
            );
          })}
        </View>
      </Card>

      {app.seasonFinishes.length ? (
        <>
          <SectionTitle>Season finishes</SectionTitle>
          <Card>
            {[...app.seasonFinishes].reverse().map((f) => (
              <Row key={f.seasonId} style={{ justifyContent: 'space-between' }}>
                <Row>
                  <RankEmblem division={f.division} size={28} />
                  <Body>{f.label}</Body>
                </Row>
                <Small>{f.sessions} sessions</Small>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Lifetime</SectionTitle>
      <Card>
        <StatRow>
          <Stat label="Sessions" value={String(life.sessions)} />
          <Stat label="Active days" value={String(life.activeDays)} />
          <Stat label="Badges" value={`${life.badges}/${life.totalBadges}`} />
        </StatRow>
        <StatRow>
          <Stat label="Time moving" value={formatDuration(life.durationSec)} />
          <Stat label="Distance" value={formatDistance(life.distanceM, units)} />
        </StatRow>
      </Card>
    </Screen>
  );
}
