/** Home / Today: rank, today's session (or rest), the week, XP progress and the weekly challenge. No feed, no pressure. */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { RankEmblem } from '../../components/RankEmblem';
import { SessionCard } from '../../components/SessionCard';
import { Body, Button, Card, H1, H2, H3, ProgressBar, Row, Screen, Small } from '../../components/ui';
import { WeekStrip } from '../../components/WeekStrip';
import { challengeById, challengeProgress } from '../../domain/challenges';
import { addDays, formatShort, weekdayLong } from '../../domain/dates';
import { activePause, freeDaysThisWeek, isRestDay, missedThisWeek, pendingCheckIns, todaySessions } from '../../domain/engine';
import { countsTowardCompletion } from '../../domain/metrics';
import { currentWeek } from '../../domain/plan';
import { divisionLabel, divisionProgress, isGated, MAX_DIVISION, gateFor, rankOf, xpToClear } from '../../domain/ranks';
import { recoveryAdvice } from '../../domain/recovery';
import { phaseFor, phaseLabel, upcomingRaces } from '../../domain/races';
import { diffDays } from '../../domain/dates';
import { daysLeft, seasonFor } from '../../domain/season';
import { XP } from '../../domain/xp';
import { today as getToday, useStore } from '../../state/store';
import { RANK_COLORS, space, useColors } from '../../theme';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const c = useColors();
  const app = useStore((s) => s.app);
  const tickEvents = useStore((s) => s.tickEvents);
  const actions = useStore.getState();
  const [restFeedback, setRestFeedback] = useState<string | null>(null);
  const today = getToday();

  useEffect(() => {
    actions.tick();
  }, [today]);

  const week = app.plan ? currentWeek(app.plan, today) : undefined;
  const sessions = todaySessions(app, today);
  const core = sessions.filter((s) => !s.optional);
  const optional = sessions.filter((s) => s.optional && s.status !== 'completed');
  const rest = isRestDay(app, today);
  const missed = missedThisWeek(app, today);
  const free = freeDaysThisWeek(app, today);
  const pause = activePause(app, today);
  const advice = recoveryAdvice(app.health.recovery?.date === today ? app.health.recovery : undefined);
  const notices = app.notices.filter((n) => !n.dismissed).slice(0, 2);
  const season = seasonFor(today);
  const rank = app.rank;
  const gated = isGated(rank);
  const nextGate = gateFor(rank.division + 1);
  const coreWeek = week?.sessions.filter(countsTowardCompletion) ?? [];
  const doneWeek = coreWeek.filter((s) => s.status === 'completed').length;
  const challenge = week ? challengeById(week.challengeId) : null;
  const chProg = useMemo(() => (week ? challengeProgress(week, app.activities, app.restClaims) : null), [week, app.activities, app.restClaims]);
  const tomorrow = addDays(today, 1);
  const canMoveTomorrow = !!week && tomorrow <= week.end && free.includes(tomorrow);
  const seasonEvent = tickEvents.find((e) => e.type === 'season_reset');
  const nextRace = upcomingRaces(app.races, today)[0];

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}>
          <Small>{greeting()}</Small>
          <H1>Today</H1>
        </View>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={`Rank ${divisionLabel(rank.division)}. Open progress`}>
          <Row>
            <View style={{ alignItems: 'flex-end' }}>
              <H3>{divisionLabel(rank.division)}</H3>
              <Small>{season.name} · {daysLeft(today)}d left</Small>
            </View>
            <RankEmblem division={rank.division} size={44} />
          </Row>
        </Pressable>
      </Row>

      {Platform.OS === 'web' ? (
        <Card style={{ borderLeftColor: c.accent, borderLeftWidth: 4 }}>
          <H3>Browser preview</H3>
          <Small>
            Tap through the real app logic here. GPS distance, Apple Health, voice cues and reminders only work in the iPhone app. Runs here record time only.
          </Small>
        </Card>
      ) : null}

      {seasonEvent && seasonEvent.type === 'season_reset' ? (
        <Card style={{ borderLeftColor: RANK_COLORS[rankOf(seasonEvent.newDivision)], borderLeftWidth: 4 }}>
          <H3>New season: {season.name}</H3>
          <Body muted>
            {seasonEvent.finish ? `You finished last season at ${divisionLabel(seasonEvent.finish.division)} — that badge is yours for good. ` : ''}
            You start this season at {divisionLabel(seasonEvent.newDivision)}.
          </Body>
          <Button kind="ghost" title="Let’s go" onPress={actions.clearTickEvents} />
        </Card>
      ) : null}

      {pause ? (
        <Card>
          <H3>Plan paused until {formatShort(pause.end)}</H3>
          <Body muted>Nothing counts against you while paused. Come back whenever you’re ready.</Body>
          <Button kind="secondary" title="I’m ready — resume plan" onPress={actions.endPause} />
        </Card>
      ) : null}

      {notices.map((n) => (
        <Card key={n.id} style={{ borderLeftColor: c.primary, borderLeftWidth: 4 }}>
          <Body>{n.text}</Body>
          <Button kind="ghost" title="Got it" onPress={() => actions.dismissNotice(n.id)} />
        </Card>
      ))}

      {advice && advice.level !== 'good' && !rest ? (
        <Card style={{ borderLeftColor: c.accent, borderLeftWidth: 4 }}>
          <H3>Recovery check</H3>
          <Body muted>{advice.text}</Body>
        </Card>
      ) : null}

      {nextRace && diffDays(today, nextRace.date) <= (nextRace.pbAttempt ? 26 * 7 : 70) ? (
        <Card onPress={() => router.push(`/race/${nextRace.id}`)} style={{ borderLeftColor: c.accent, borderLeftWidth: 4 }}>
          <Small style={{ fontWeight: '700', color: c.accent }}>
            {diffDays(today, nextRace.date) === 0 ? 'RACE DAY' : `RACE IN ${diffDays(today, nextRace.date)} DAY${diffDays(today, nextRace.date) === 1 ? '' : 'S'}`}
          </Small>
          <H3>{nextRace.name}</H3>
          <Small>
            {formatShort(nextRace.date)} · {nextRace.pbAttempt ? `PB attempt · ${phaseLabel(phaseFor(nextRace, week?.start ?? today))}` : 'For fun'}
          </Small>
        </Card>
      ) : null}

      {pendingCheckIns(app, today).slice(0, 1).map((a) => (
        <Card key={a.id} onPress={() => router.push(`/summary/${a.id}`)}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <View style={{ flex: 1 }}>
              <H3>How did {a.date === today ? 'today’s' : `${weekdayLong(a.date)}’s`} run feel?</H3>
              <Small>{a.importedFrom ? 'Counted from your watch. ' : ''}A 5-second check-in helps your plan adapt (+10 XP).</Small>
            </View>
            <Small style={{ color: c.primary, fontWeight: '700' }}>Check in</Small>
          </Row>
        </Card>
      ))}

      {!pause && missed.length > 0 ? (
        <Card>
          <H3>{weekdayLong(missed[0].date)}’s session didn’t happen</H3>
          <Body muted>That’s completely fine. What would you like to do?</Body>
          <View style={{ gap: space.sm }}>
            {free.length > 0 ? (
              <Button
                kind="secondary"
                title={free[0] === today ? 'Do it today' : `Move to ${weekdayLong(free[0])}`}
                onPress={() => actions.moveSession(missed[0].id, free[0])}
              />
            ) : null}
            <Button kind="secondary" title="Shorten my week" onPress={() => actions.dropSession(missed[0].id)} />
            <Button kind="ghost" title="Let it go" onPress={() => actions.skipSession(missed[0].id)} />
          </View>
        </Card>
      ) : null}

      {!pause && core.map((s) => (
        <SessionCard
          key={s.id}
          session={s}
          onSwap={s.kind === 'run' && s.status === 'planned' ? () => actions.swapForMobility(s.id) : undefined}
          onMoveTomorrow={s.status === 'planned' && canMoveTomorrow ? () => actions.moveSession(s.id, tomorrow) : undefined}
        />
      ))}

      {!pause && rest ? (
        <Card>
          <Small style={{ fontWeight: '700', color: c.rest }}>REST DAY</Small>
          <H2>Rest is training</H2>
          <Body muted>Your body adapts and gets stronger on days like this. Enjoy it.</Body>
          {app.restClaims.includes(today) ? (
            <Small>Rest day logged ✓</Small>
          ) : (
            <Button
              kind="secondary"
              title={`Log rest day (+${XP.restDay} XP)`}
              onPress={() => {
                const ev = actions.claimRestDay();
                setRestFeedback(ev.some((e) => e.type === 'xp') ? 'Nice. Recovery counts.' : null);
              }}
            />
          )}
          {restFeedback ? <Small>{restFeedback}</Small> : null}
        </Card>
      ) : null}

      {!pause && optional.map((s) => <SessionCard key={s.id} session={s} compact />)}

      {week ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <H3>This week</H3>
            <Small>
              {doneWeek} of {coreWeek.length} sessions
            </Small>
          </Row>
          <WeekStrip week={week} today={today} />
          <Small>
            {app.weeklyTargetPaid.includes(week.start)
              ? `Weekly target hit ✓ (+${XP.weeklyTarget} XP)`
              : `Complete your planned sessions this week for a +${XP.weeklyTarget} XP bonus.`}
          </Small>
          {week.phaseNote ? <Small muted={false} style={{ fontWeight: '600' }}>{week.phaseNote}</Small> : null}
          <Small style={{ fontStyle: 'italic' }}>{week.summary}</Small>
        </Card>
      ) : null}

      <Card onPress={() => router.push('/profile')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>{divisionLabel(rank.division)}</H3>
          <Small>
            {rank.division >= MAX_DIVISION ? `${rank.xp} XP` : `${Math.min(rank.xp, xpToClear(rank.division))} / ${xpToClear(rank.division)} XP`}
          </Small>
        </Row>
        <ProgressBar value={divisionProgress(rank)} color={RANK_COLORS[rankOf(rank.division)]} />
        <Small>
          {gated && nextGate
            ? `Bar full! To reach ${divisionLabel(rank.division + 1)}, keep your plan completion above ${Math.round(nextGate.minCompletion * 100)}% for a few weeks. Your extra XP is saved.`
            : rank.division >= MAX_DIVISION
              ? 'Grandmaster. Keep showing up.'
              : `${xpToClear(rank.division) - rank.xp} XP to ${divisionLabel(rank.division + 1)}`}
        </Small>
      </Card>

      {challenge && chProg ? (
        <Card>
          <Small style={{ fontWeight: '700', color: c.accent }}>WEEKLY CHALLENGE · +{XP.weeklyChallenge} XP</Small>
          <H3>{challenge.title}</H3>
          <Small>{challenge.description}</Small>
          <ProgressBar value={chProg.current / chProg.target} color={c.accent} height={8} />
          <Small>{chProg.done ? 'Complete ✓' : `${chProg.current} / ${chProg.target}`}</Small>
        </Card>
      ) : null}

      <Button kind="ghost" title="Go for an extra easy run" onPress={() => router.push('/session/free')} />
    </Screen>
  );
}
