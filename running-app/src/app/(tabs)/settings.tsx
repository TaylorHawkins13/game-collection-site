/** Plan & settings: adjust the plan, pause for life, reminders, run options, health, data. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { CustomWeekEditor } from '../../components/CustomWeekEditor';
import { PbEditor } from '../../components/PbEditor';
import { currentWeek, templateFromWeek } from '../../domain/plan';
import { phaseFor, phaseLabel, upcomingRaces } from '../../domain/races';
import { formatDistance } from '../../domain/gps';
import { Body, Button, Card, Chip, Divider, H1, H3, Option, OptionGroup, Row, Screen, SectionTitle, Small } from '../../components/ui';
import { goalLabel, goalsFor } from '../../goals';
import { currentPaces, direction } from '../../domain/fitness';
import { formatTime, paceLabel } from '../../domain/pace';
import type { FitnessReason } from '../../domain/types';

const REASON: Record<FitnessReason, string> = {
  pb: 'Set from your PBs',
  estimated: 'Estimated from your first runs',
  faster_run: 'Faster run / new PB',
  workouts_easy: 'Workouts felt easy',
  easy_trend: 'Easy runs getting quicker',
  workouts_hard: 'Workouts felt hard',
  easy_struggle: 'Easy runs felt hard',
  break: 'Time off running',
};
import { formatShort, weekdayName, weekdayShort } from '../../domain/dates';
import { activePause, previewNextWeek } from '../../domain/engine';
import type { ExperienceLevel, Pause, Profile } from '../../domain/types';
import { confirmDialog } from '../../services/dialog';
import { health } from '../../services/health';
import { requestNotificationPermission, scheduleReminders } from '../../services/notifications';
import { refreshRecovery } from '../../services/sync';
import { useRunStore } from '../../state/runStore';
import { today as getToday, useStore } from '../../state/store';
import { space, useColors } from '../../theme';

const LEVEL_LABEL: Record<ExperienceLevel, string> = {
  new: 'New to running',
  returning: 'Returning',
  consistent: 'Already consistent',
  experienced: 'Experienced',
};

function Toggle({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
      <View style={{ flex: 1 }}>
        <H3>{label}</H3>
        {help ? <Small>{help}</Small> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </Row>
  );
}

function Stepper({ label, value, min, max, onChange, format }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
      <H3>{label}</H3>
      <Row>
        <Button kind="secondary" title="−" onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} />
        <Body style={{ minWidth: 56, textAlign: 'center' }}>{format ? format(value) : value}</Body>
        <Button kind="secondary" title="+" onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} />
      </Row>
    </Row>
  );
}

const fmtTime = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`;

export default function Settings() {
  const c = useColors();
  const app = useStore((s) => s.app);
  const s = useStore.getState();
  const p = app.profile!;
  const today = getToday();
  const pause = activePause(app, today);
  const preview = previewNextWeek(app, today);
  const [pauseReason, setPauseReason] = useState<Pause['reason']>('busy');
  const [healthMsg, setHealthMsg] = useState<string | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const fitnessPaces = currentPaces(app);

  const update = (patch: Partial<Profile>) => {
    s.updateProfile(patch);
    void scheduleReminders(useStore.getState().app, today).catch(() => undefined);
  };

  const shiftTime = (key: 'morningReminder' | 'afternoonNudge', deltaMin: number) => {
    const r = p[key];
    const total = (r.hour * 60 + r.minute + deltaMin + 24 * 60) % (24 * 60);
    update({ [key]: { ...r, hour: Math.floor(total / 60), minute: total % 60 } });
  };

  const maxRuns = p.level === 'new' ? 4 : 5;
  const toggleDay = (d: number) => {
    const cur = p.preferredDays;
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].slice(-p.runsPerWeek);
    update({ preferredDays: next.sort() });
  };

  return (
    <Screen>
      <H1>Your plan</H1>

      <SectionTitle>Races</SectionTitle>
      {upcomingRaces(app.races, today).map((r) => (
        <Card key={r.id} onPress={() => router.push(`/race/${r.id}`)}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <View style={{ flex: 1 }}>
              <H3>{r.name}</H3>
              <Small>
                {weekdayShort(r.date)} {formatShort(r.date)} · {formatDistance(r.distanceM, p.units)} · {r.terrain.replace('_', '-')}
              </Small>
              <Small muted={false}>
                {r.pbAttempt ? 'PB attempt' : 'For fun / training'}
                {r.pbAttempt ? ` · ${phaseLabel(phaseFor(r, today))}` : ''}
              </Small>
            </View>
            <Small style={{ color: c.primary, fontWeight: '700' }}>Edit</Small>
          </Row>
        </Card>
      ))}
      {(app.races ?? []).filter((r) => r.result).slice(-3).reverse().map((r) => (
        <Card key={r.id}>
          <Small>
            ✓ {r.name} · {formatShort(r.date)} · finished in {formatTime(r.result!.timeSec)}
          </Small>
        </Card>
      ))}
      <Button kind="secondary" title="+ Add a race" onPress={() => router.push('/race/new')} />

      <SectionTitle>Plan type</SectionTitle>
      <OptionGroup>
        <Option
          label="Steady builds it for me"
          description="Adapts to your check-ins, fitness and races. Recommended."
          selected={p.planMode !== 'custom'}
          onPress={() => update({ planMode: 'adaptive' })}
        />
        <Option
          label="I’ll plan it myself"
          description="Set your own weekly sessions. Ranks, XP and races still work."
          selected={p.planMode === 'custom'}
          onPress={() => {
            const wk = app.plan ? currentWeek(app.plan, today) : undefined;
            update({ planMode: 'custom', customWeek: p.customWeek?.length ? p.customWeek : wk ? templateFromWeek(wk) : [] });
          }}
        />
      </OptionGroup>
      {p.planMode === 'custom' ? <CustomWeekEditor week={p.customWeek ?? []} onChange={(customWeek) => update({ customWeek })} /> : null}

      <SectionTitle>Goal & best times</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View style={{ flex: 1 }}>
            <Small>Training for</Small>
            <H3>{goalLabel(p.goal)}</H3>
          </View>
          <Button kind="ghost" title={showGoals ? 'Done' : 'Change'} onPress={() => setShowGoals(!showGoals)} />
        </Row>
      </Card>
      {showGoals ? (
        <OptionGroup>
          {goalsFor(p.level).map((g) => (
            <Option key={g.id} label={g.label} description={g.description} selected={p.goal === g.id} onPress={() => update({ goal: g.id })} />
          ))}
        </OptionGroup>
      ) : null}
      {p.level !== 'new' ? (
        <Card>
          <H3>Current fitness</H3>
          {fitnessPaces ? (
            <>
              <Small muted={false}>
                5K estimate {formatTime(fitnessPaces.fiveKSec)} · easy {paceLabel(fitnessPaces.easy[0], p.units)}–{paceLabel(fitnessPaces.easy[1], p.units)}/{p.units} · tempo ~
                {paceLabel(fitnessPaces.tempo, p.units)} · intervals ~{paceLabel(fitnessPaces.interval, p.units)}
              </Small>
              <Small>Updates automatically as your runs show you getting fitter (or need an easier patch).</Small>
              {(app.fitness?.log ?? []).slice(-4).reverse().map((l, i) => (
                <Small key={i} muted={false}>
                  {direction(l.reason) === 'up' ? '↑' : direction(l.reason) === 'down' ? '↓' : '•'} {formatShort(l.date)} · {REASON[l.reason]} → {formatTime(l.fiveKSec)}
                </Small>
              ))}
            </>
          ) : (
            <Small>Add a PB below, or do a few easy runs with GPS and Steady will estimate it for you.</Small>
          )}
        </Card>
      ) : null}
      <PbEditor
        pbs={p.pbs ?? []}
        onChange={(pbs) => update({ pbs })}
        level={p.level}
        goal={p.goal}
        goalTimeSec={p.goalTimeSec}
        onGoalTime={(goalTimeSec) => update({ goalTimeSec })}
        units={p.units}
        showPaces={false}
      />


      {p.planMode !== 'custom' ? (
        <>
      <SectionTitle>Plan</SectionTitle>
      <Card style={{ gap: space.md }}>
        <View style={{ gap: space.sm }}>
          <H3>Starting point</H3>
          <Small>Sets plan intensity and guidance. Not a rank.</Small>
          <Row>
            {(Object.keys(LEVEL_LABEL) as ExperienceLevel[]).map((l) => (
              <Chip
                key={l}
                label={LEVEL_LABEL[l]}
                selected={p.level === l}
                onPress={() =>
                  l !== p.level &&
                  confirmDialog('Change starting point?', 'The rest of this week will be rebuilt to match. Completed sessions stay.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Change', onPress: () => update({ level: l, frequency: l === 'new' || l === 'returning' ? p.frequency ?? 0 : null }) },
                  ])
                }
              />
            ))}
          </Row>
        </View>
        <Divider />
        <Stepper label="Runs per week" value={p.runsPerWeek} min={2} max={maxRuns} onChange={(v) => update({ runsPerWeek: v, preferredDays: p.preferredDays.slice(0, v) })} />
        <Stepper label="Strength / mobility" value={p.strengthPerWeek} min={0} max={2} onChange={(v) => update({ strengthPerWeek: v })} format={(v) => (v ? `${v}/wk` : 'Off')} />
        <View style={{ gap: space.sm }}>
          <H3>Run days</H3>
          <Small>{p.preferredDays.length >= p.runsPerWeek ? 'Your chosen days.' : `Pick ${p.runsPerWeek} days, or leave as-is for automatic spacing.`}</Small>
          <Row>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <Chip key={d} label={weekdayName(d)} selected={p.preferredDays.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </Row>
          {p.preferredDays.length ? <Button kind="ghost" title="Use automatic days" onPress={() => update({ preferredDays: [] })} /> : null}
        </View>
        {p.level === 'consistent' || p.level === 'experienced' ? (
          <Toggle label="Light quality (strides)" help="One easy run per week ends with a few relaxed strides." value={p.includeQuality} onChange={(v) => update({ includeQuality: v })} />
        ) : null}
        <Small>Changes apply from today; finished sessions are never touched.</Small>
      </Card>

        </>
      ) : null}

      {preview ? (
        <Card>
          <H3>Next week (preview)</H3>
          <Small>Adjusts automatically based on how this week goes.</Small>
          {preview.sessions.map((x) => (
            <Small key={x.id} muted={false}>
              {weekdayShort(x.date)} {formatShort(x.date)} · {x.title}
              {x.optional ? ' (optional)' : ''}
            </Small>
          ))}
        </Card>
      ) : null}

      <SectionTitle>Life happens</SectionTitle>
      <Card>
        {pause ? (
          <>
            <H3>Paused until {formatShort(pause.end)}</H3>
            <Button kind="secondary" title="Resume now" onPress={s.endPause} />
          </>
        ) : (
          <>
            <Body muted>Sick, injured, travelling, or just swamped? Pause the plan. Missed sessions and rank decay are frozen, and you’ll restart gently.</Body>
            <Row>
              {(['sick', 'injury', 'travel', 'busy'] as Pause['reason'][]).map((r) => (
                <Chip key={r} label={r[0].toUpperCase() + r.slice(1)} selected={pauseReason === r} onPress={() => setPauseReason(r)} />
              ))}
            </Row>
            <Row>
              {[3, 7, 14].map((d) => (
                <Button key={d} kind="secondary" title={d === 7 ? '1 week' : d === 14 ? '2 weeks' : `${d} days`} onPress={() => s.pausePlan(d, pauseReason)} />
              ))}
            </Row>
          </>
        )}
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Toggle
          label="Morning reminder"
          help="Only on days with a session."
          value={p.morningReminder.enabled}
          onChange={async (v) => {
            if (v) await requestNotificationPermission();
            update({ morningReminder: { ...p.morningReminder, enabled: v } });
          }}
        />
        {p.morningReminder.enabled ? (
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button kind="secondary" title="−15m" onPress={() => shiftTime('morningReminder', -15)} />
            <Body>{fmtTime(p.morningReminder.hour, p.morningReminder.minute)}</Body>
            <Button kind="secondary" title="+15m" onPress={() => shiftTime('morningReminder', 15)} />
          </Row>
        ) : null}
        <Toggle
          label="Gentle afternoon nudge"
          help="One optional nudge if the session isn’t done yet."
          value={p.afternoonNudge.enabled}
          onChange={async (v) => {
            if (v) await requestNotificationPermission();
            update({ afternoonNudge: { ...p.afternoonNudge, enabled: v } });
          }}
        />
        {p.afternoonNudge.enabled ? (
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button kind="secondary" title="−15m" onPress={() => shiftTime('afternoonNudge', -15)} />
            <Body>{fmtTime(p.afternoonNudge.hour, p.afternoonNudge.minute)}</Body>
            <Button kind="secondary" title="+15m" onPress={() => shiftTime('afternoonNudge', 15)} />
          </Row>
        ) : null}
      </Card>

      <SectionTitle>Runs</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>Units</H3>
          <Row>
            <Chip label="km" selected={p.units === 'km'} onPress={() => update({ units: 'km' })} />
            <Chip label="miles" selected={p.units === 'mi'} onPress={() => update({ units: 'mi' })} />
          </Row>
        </Row>
        <Toggle label="Voice cues" help="Interval prompts and occasional form reminders." value={p.audioCues} onChange={(v) => update({ audioCues: v })} />
        <Toggle label="Announce splits" value={p.splitAnnouncements} onChange={(v) => update({ splitAnnouncements: v })} />
        <Toggle label="Hide route start & end" help="Trims ~200 m from each end on maps and in health exports." value={p.hideRouteEnds} onChange={(v) => update({ hideRouteEnds: v })} />
      </Card>

      <SectionTitle>Health</SectionTitle>
      <Card>
        {health.name ? (
          <>
            <H3>{health.name}</H3>
            <Small>{app.health.connected ? 'Connected. Workouts are saved automatically; sleep and resting HR inform plan notes.' : 'Not connected.'}</Small>
            {app.health.connected ? (
              <Button kind="ghost" title="Disconnect in Steady" onPress={() => s.setHealthConnected(false)} />
            ) : (
              <Button
                kind="secondary"
                title={`Connect ${health.name}`}
                onPress={async () => {
                  const ok = await health.connect().catch(() => false);
                  if (ok) {
                    s.setHealthConnected(true);
                    void refreshRecovery();
                  }
                  setHealthMsg(ok ? null : 'Couldn’t connect. Check permissions in your health app settings.');
                }}
              />
            )}
            {healthMsg ? <Small style={{ color: c.danger }}>{healthMsg}</Small> : null}
          </>
        ) : (
          <Small>Health sync isn’t available on this device.</Small>
        )}
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card>
        <Small>Everything is stored on this device. No account, no social feed.</Small>
        <Button
          kind="ghost"
          title="Reset all data"
          onPress={() =>
            confirmDialog('Reset everything?', 'This deletes your plan, history, ranks and badges on this device.', [
              { text: 'Cancel', style: 'cancel', web: true },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: () => {
                  useRunStore.getState().clear();
                  s.resetAll();
                  router.replace('/onboarding');
                },
              },
            ])
          }
        />
      </Card>
      <Small style={{ textAlign: 'center' }}>Steady offers general fitness guidance, not medical advice.</Small>
    </Screen>
  );
}
