/**
 * Onboarding (< 3 minutes, no account wall): welcome → starting point →
 * (frequency) → goal → health (skippable) → anything to know → first week → Home.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { Body, Button, Card, Chip, H1, H3, Option, OptionGroup, Row, Screen, SectionTitle, Small } from '../components/ui';
import { formatShort, weekdayShort } from '../domain/dates';
import { defaultProfile, type OnboardingAnswers } from '../domain/engine';
import { createPlan } from '../domain/plan';
import type { ExperienceLevel, GoalId, IssueId, PersonalBest, WeeklyFrequency } from '../domain/types';
import { PbEditor } from '../components/PbEditor';
import { sessionSubtitle } from '../components/SessionCard';
import { pacesFor } from '../domain/pace';
import { goalsFor, pbsRequired } from '../goals';
import { health } from '../services/health';
import { requestNotificationPermission } from '../services/notifications';
import { today, useStore } from '../state/store';
import { space, useColors } from '../theme';

type Step = 'welcome' | 'level' | 'frequency' | 'goal' | 'pbs' | 'health' | 'issues' | 'plan';

const LEVELS: { id: ExperienceLevel; label: string; description: string }[] = [
  { id: 'new', label: 'New to running', description: 'Starting from scratch — walk-run sessions to begin.' },
  { id: 'returning', label: 'Returning', description: 'I used to run and want to get back into it.' },
  { id: 'consistent', label: 'Already consistent', description: 'I run most weeks and want to keep it going.' },
  { id: 'experienced', label: 'Experienced', description: 'Running is a regular part of my life.' },
];

const ISSUES: { id: IssueId; label: string }[] = [
  { id: 'knee', label: 'Knees' },
  { id: 'shin', label: 'Shins' },
  { id: 'calf_achilles', label: 'Calves / Achilles' },
  { id: 'hip_back', label: 'Hips / lower back' },
  { id: 'fatigue', label: 'Low energy / tired' },
];

export default function Onboarding() {
  const c = useColors();
  const onboard = useStore((s) => s.onboard);
  const setHealthConnected = useStore((s) => s.setHealthConnected);
  const [step, setStep] = useState<Step>('welcome');
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [frequency, setFrequency] = useState<WeeklyFrequency | null>(null);
  const [goal, setGoal] = useState<GoalId>('habit');
  const [includeQuality, setIncludeQuality] = useState(false);
  const [issues, setIssues] = useState<IssueId[]>([]);
  const [pbs, setPbs] = useState<PersonalBest[]>([]);
  const [goalTimeSec, setGoalTimeSec] = useState<number | undefined>(undefined);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthDone, setHealthDone] = useState<boolean | null>(null);

  const answers: OnboardingAnswers | null = level ? { level, frequency, goal, issues, includeQuality, pbs, goalTimeSec } : null;
  const preview = useMemo(() => (answers ? createPlan(defaultProfile(answers, today()), today()).weeks[0] : null), [level, frequency, goal, issues, includeQuality, pbs]);

  const needsFrequency = level === 'new' || level === 'returning';
  const askPbs = level !== 'new' || goal.endsWith('_faster');
  const mustPbs = pbsRequired(level, goal);
  const order: Step[] = ['welcome', 'level', ...(needsFrequency ? (['frequency'] as Step[]) : []), 'goal', ...(askPbs ? (['pbs'] as Step[]) : []), 'health', 'issues', 'plan'];
  const next = () => setStep(order[Math.min(order.length - 1, order.indexOf(step) + 1)]);
  const back = () => setStep(order[Math.max(0, order.indexOf(step) - 1)]);
  const progress = order.indexOf(step) / (order.length - 1);

  const finish = async () => {
    if (!answers) return;
    onboard(answers);
    if (healthDone) setHealthConnected(true);
    void requestNotificationPermission().catch(() => undefined);
    router.replace('/');
  };

  const connectHealth = async () => {
    setHealthBusy(true);
    const ok = await health.connect().catch(() => false);
    setHealthBusy(false);
    setHealthDone(ok);
    if (ok) next();
  };

  const footer = (primary: string, onPress: () => void, disabled = false, secondary?: { title: string; onPress: () => void }) => (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      <Button title={primary} onPress={onPress} disabled={disabled} big />
      {secondary ? <Button title={secondary.title} onPress={secondary.onPress} kind="ghost" /> : null}
      {step !== 'welcome' ? <Button title="Back" onPress={back} kind="ghost" /> : null}
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      {step !== 'welcome' ? (
        <View style={{ height: 4, backgroundColor: c.surfaceAlt, borderRadius: 2 }}>
          <View style={{ height: 4, width: `${progress * 100}%`, backgroundColor: c.primary, borderRadius: 2 }} />
        </View>
      ) : null}

      {step === 'welcome' && (
        <View style={{ gap: space.lg, paddingTop: space.xxl * 2 }}>
          <H1>Run steady.</H1>
          <Body muted>
            A calm, flexible plan that rewards showing up. Every run earns XP, and hitting what your plan asked for earns the most. Missed a day? No drama — your plan simply adapts.
          </Body>
          <Card>
            <Body>• Easy first week, built for you in under 3 minutes</Body>
            <Body>• Climb seasonal ranks by being consistent</Body>
            <Body>• Built-in protection against doing too much too soon</Body>
          </Card>
          {footer("Let's start", next)}
          <Small style={{ textAlign: 'center' }}>No account needed. Your data stays on your phone.</Small>
        </View>
      )}

      {step === 'level' && (
        <View style={{ gap: space.md }}>
          <H1>Where are you starting from?</H1>
          <Body muted>This just sets how gentle your first weeks are. It isn’t a rank, and you can change it anytime.</Body>
          <OptionGroup>
            {LEVELS.map((l) => (
              <Option key={l.id} label={l.label} description={l.description} selected={level === l.id} onPress={() => setLevel(l.id)} />
            ))}
          </OptionGroup>
          {footer('Continue', next, !level)}
        </View>
      )}

      {step === 'frequency' && (
        <View style={{ gap: space.md }}>
          <H1>How often do you run right now?</H1>
          <Body muted>Roughly, in a typical week lately. Zero is a perfectly good answer.</Body>
          <OptionGroup>
            {([0, 1, 2, 3] as WeeklyFrequency[]).map((f) => (
              <Option key={f} label={f === 3 ? '3 or more times' : f === 0 ? 'Not at the moment' : `${f} time${f > 1 ? 's' : ''} a week`} selected={frequency === f} onPress={() => setFrequency(f)} />
            ))}
          </OptionGroup>
          {footer('Continue', next, frequency === null, { title: 'Skip', onPress: () => { setFrequency(0); next(); } })}
        </View>
      )}

      {step === 'goal' && (
        <View style={{ gap: space.md }}>
          <H1>Anything you’re working toward?</H1>
          <Body muted>Optional. Your plan stays easy either way.</Body>
          {(['Just run', 'Distance goals', 'Get faster'] as const).map((group) => {
            const opts = goalsFor(level).filter((g) => g.group === group);
            return opts.length ? (
              <View key={group} style={{ gap: space.xs }}>
                <SectionTitle>{group}</SectionTitle>
                <OptionGroup>
                  {opts.map((g) => (
                    <Option key={g.id} label={g.label} description={g.description} selected={goal === g.id} onPress={() => setGoal(g.id)} />
                  ))}
                </OptionGroup>
              </View>
            ) : null;
          })}
          {level === 'experienced' || level === 'consistent' ? (
            <Card>
              <H3>Include one light quality session?</H3>
              <Small>Easy run with a few short, relaxed strides. Otherwise everything stays easy.</Small>
              <Row>
                <Chip label="All easy" selected={!includeQuality} onPress={() => setIncludeQuality(false)} />
                <Chip label="Add strides" selected={includeQuality} onPress={() => setIncludeQuality(true)} />
              </Row>
            </Card>
          ) : null}
          {footer('Continue', next)}
        </View>
      )}

      {step === 'pbs' && level && (
        <View style={{ gap: space.md }}>
          <H1>Your best times</H1>
          <Body muted>
            {mustPbs
              ? 'Add at least one personal best. Your plan uses it to set your easy pace and the targets for any faster sessions.'
              : 'Got any race or timed-run bests? They help set your easy pace. Skip if you don’t have one.'}
          </Body>
          <PbEditor pbs={pbs} onChange={setPbs} level={level} goal={goal} goalTimeSec={goalTimeSec} onGoalTime={setGoalTimeSec} units="km" />
          {footer(
            'Continue',
            next,
            mustPbs && pbs.length === 0,
            mustPbs ? undefined : { title: 'I don’t have any times', onPress: () => { setPbs([]); next(); } },
          )}
          {mustPbs && pbs.length === 0 ? <Small style={{ textAlign: 'center' }}>Not sure? A recent parkrun or a timed 5K on your watch works fine.</Small> : null}
        </View>
      )}

      {step === 'health' && (
        <View style={{ gap: space.md }}>
          <H1>Connect {health.name ?? 'your health app'}?</H1>
          <Body muted>
            Optional. With it, Steady can show heart rate after runs, save your workouts automatically, and use sleep and resting heart rate to suggest easier days when you need them.
          </Body>
          <Card>
            <Small>We read: heart rate, resting heart rate, sleep. We write: your completed workouts. Nothing leaves your phone.</Small>
          </Card>
          {healthDone === false ? (
            <Small style={{ color: c.danger }}>
              Couldn’t connect{Platform.OS === 'android' ? ' — Health Connect may need installing or updating' : ''}. You can try again later in Settings.
            </Small>
          ) : null}
          {health.name
            ? footer(healthBusy ? 'Connecting…' : `Connect ${health.name}`, connectHealth, healthBusy, { title: 'Not now', onPress: next })
            : footer('Continue', next)}
        </View>
      )}

      {step === 'issues' && (
        <View style={{ gap: space.md }}>
          <H1>Anything we should know?</H1>
          <Body muted>Optional. Pick anything that’s been bothering you and we’ll keep things more conservative and add helpful strength work.</Body>
          <Row>
            {ISSUES.map((i) => (
              <Chip
                key={i.id}
                label={i.label}
                selected={issues.includes(i.id)}
                onPress={() => setIssues((cur) => (cur.includes(i.id) ? cur.filter((x) => x !== i.id) : [...cur, i.id]))}
              />
            ))}
          </Row>
          <Small>Steady isn’t medical advice. If something hurts sharply or doesn’t improve, please see a professional.</Small>
          {footer(issues.length ? 'Continue' : 'Nothing to add', next)}
        </View>
      )}

      {step === 'plan' && preview && (
        <View style={{ gap: space.md }}>
          <H1>Your first week</H1>
          <Body muted>{preview.summary}</Body>
          {preview.sessions.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 54 }}>
                <H3>{weekdayShort(s.date)}</H3>
                <Small>{formatShort(s.date)}</Small>
              </View>
              <View style={{ flex: 1 }}>
                <H3>{s.title}</H3>
                <Small>
                  {sessionSubtitle(s, answers ? defaultProfile(answers, today()) : null, pacesFor(pbs, level ?? 'new'))}
                  {s.optional ? ' · optional' : ''}
                </Small>
              </View>
            </Card>
          ))}
          <Small>Everything else is a rest day. Rest is part of the plan.</Small>
          {footer('Looks good — let’s go', finish)}
        </View>
      )}
    </Screen>
  );
}
