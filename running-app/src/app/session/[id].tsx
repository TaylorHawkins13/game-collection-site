/**
 * In-session screen. Runs: glanceable stats, walk-run phase guidance, audio
 * cues, pause/resume, background + screen-off GPS, treadmill mode. Strength:
 * a simple checklist with a timer.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiveMap } from '../../components/LiveMap';
import { sessionSubtitle } from '../../components/SessionCard';
import { Body, Button, Card, Chip, H1, H2, H3, ProgressBar, RoundButton, Row, Screen, Small, Stat, StatRow } from '../../components/ui';
import { walkRunPhase } from '../../domain/cues';
import { toDateKey } from '../../domain/dates';
import { findSession } from '../../domain/engine';
import { averagePace, currentPace, finalSplits, formatDuration, formatPace, METERS_PER_UNIT, movingMs } from '../../domain/gps';
import { currentPaces } from '../../domain/fitness';
import { paceLabel } from '../../domain/pace';
import { routineById } from '../../domain/strength';
import type { PlannedSession } from '../../domain/types';
import { confirmDialog } from '../../services/dialog';
import { setAudioEnabled, speak, stopSpeaking } from '../../services/audio';
import { currentLiveStatus, guidanceTick } from '../../services/guidance';
import { health } from '../../services/health';
import { hrStrap } from '../../services/heartRate';
import { liveStats } from '../../services/liveActivity';
import { summarizeSamples } from '../../domain/hr';
import { ensureTrackingAfterRestore, setBackgroundTickListener, startTracking, stopTracking } from '../../services/locationTracking';
import { cancelTodayNudge } from '../../services/notifications';
import { syncActivityToHealth, syncActivityToStrava } from '../../services/sync';
import { useRunStore } from '../../state/runStore';
import { useStore } from '../../state/store';
import { font, radius, space, useColors } from '../../theme';

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useStore((s) => s.app);
  const found = id && id !== 'free' ? findSession(app, id) : null;
  const session = found?.session ?? null;
  if (session?.kind === 'strength') return <StrengthSession session={session} />;
  return <RunSession session={session} />;
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

// ───────────────────────────── run ─────────────────────────────

function RunSession({ session }: { session: PlannedSession | null }) {
  const c = useColors();
  const profile = useStore((s) => s.app.profile)!;
  const completeSession = useStore((s) => s.completeSession);
  const active = useRunStore((s) => s.active);
  const run = useRunStore.getState();
  const [treadmill, setTreadmill] = useState(false);
  const [keepAwake, setKeepAwake] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [treadmillKm, setTreadmillKm] = useState('');
  const now = useNow(!!active);
  const restored = useRef(false);
  const units = profile.units;

  // Restore a run after the app was killed mid-session.
  useEffect(() => {
    if (active && !restored.current) {
      restored.current = true;
      if (!active.tracker.treadmill && !active.tracker.paused) {
        void ensureTrackingAfterRestore().then((m) => run.setGpsMode(m === 'denied' ? 'none' : m));
      }
      connectStrap();
    }
  }, []);

  // Heart-rate strap: connect at the start of a run, reconnect once if it drops.
  const connectStrap = () => {
    const dev = useStore.getState().app.profile?.hrDevice;
    if (!dev || !hrStrap.supported) return;
    let retried = false;
    const attempt = () => {
      run.setStrapStatus('connecting');
      hrStrap
        .connect(dev.id, (bpm) => useRunStore.getState().pushHr(bpm, 'strap'), () => {
          run.setStrapStatus('lost');
          if (!retried && useRunStore.getState().active) {
            retried = true;
            setTimeout(attempt, 5000);
          }
        })
        .then(() => run.setStrapStatus('connected'))
        .catch(() => run.setStrapStatus('lost'));
    };
    attempt();
  };

  // No strap? Read a watch's heart rate from Apple Health / Health Connect while it records alongside.
  useEffect(() => {
    if (!active || !useStore.getState().app.health.connected) return;
    const startedAt = active.tracker.startedAt;
    const poll = async () => {
      const cur = useRunStore.getState().active;
      if (!cur || (cur.hr?.source === 'strap' && Date.now() - cur.hr.t < 15_000)) return;
      const bpm = await health.latestHeartRate(Math.max(startedAt, Date.now() - 120_000)).catch(() => null);
      if (bpm) useRunStore.getState().pushHr(bpm, 'health');
    };
    void poll();
    const id = setInterval(() => void poll(), 20_000);
    return () => clearInterval(id);
  }, [!!active]);

  useEffect(() => {
    setAudioEnabled(profile.audioCues);
    setBackgroundTickListener(guidanceTick);
    return () => setBackgroundTickListener(null);
  }, [profile.audioCues]);

  useEffect(() => {
    if (active) guidanceTick();
  }, [now]);

  // Only release the wake lock if we actually took it (releasing an unheld lock throws).
  const awake = useRef(false);
  useEffect(() => {
    if (keepAwake && active && !awake.current) {
      awake.current = true;
      activateKeepAwakeAsync('run').catch(() => (awake.current = false));
    }
    const release = () => {
      if (!awake.current) return;
      awake.current = false;
      Promise.resolve(deactivateKeepAwake('run')).catch(() => undefined);
    };
    if (!keepAwake || !active) release();
    return release;
  }, [keepAwake, !!active]);

  const begin = async () => {
    setGpsError(null);
    run.start({ plannedSessionId: session?.id, title: session?.title ?? 'Easy run', units, treadmill });
    connectStrap();
    if (useStore.getState().app.profile?.liveStats !== false) {
      const st = currentLiveStatus();
      if (st) liveStats.start(st);
    }
    if (!treadmill) {
      const mode = await startTracking().catch(() => 'denied' as const);
      if (mode === 'denied') {
        setGpsError('Location is off, so distance won’t be recorded. Time and guidance still work — or switch to treadmill mode.');
        run.setGpsMode('none');
      } else {
        run.setGpsMode(mode);
        if (mode === 'foreground') setGpsError('Background location is off: keep the app open for accurate GPS. You can allow “Always” in Settings.');
      }
    }
    guidanceTick();
  };

  const save = async () => {
    const a = useRunStore.getState().active;
    if (!a) return;
    await stopTracking();
    stopSpeaking();
    const end = Date.now();
    const t = a.tracker.paused ? a.tracker : { ...a.tracker, segments: a.tracker.segments.map((s, i, arr) => (i === arr.length - 1 && !s.end ? { ...s, end } : s)) };
    const durationSec = movingMs(t, end) / 1000;
    const strapHr = summarizeSamples(a.hrSamples ?? []);
    liveStats.end({ title: `${formatDuration(durationSec)}${t.distanceM > 0 && !t.treadmill ? ` · ${(t.distanceM / METERS_PER_UNIT[units]).toFixed(2)} ${units}` : ''}`, subtitle: 'Run saved. Nice work showing up.' });
    void hrStrap.disconnect();
    const manual = parseFloat(treadmillKm.replace(',', '.'));
    const distanceM = t.treadmill ? (isFinite(manual) && manual > 0 ? manual * METERS_PER_UNIT[units] : undefined) : t.distanceM > 0 ? t.distanceM : undefined;
    const activityId = completeSession({
      plannedSessionId: a.plannedSessionId,
      kind: 'run',
      title: a.title,
      startedAt: t.startedAt,
      endedAt: end,
      durationSec,
      distanceM,
      treadmill: t.treadmill,
      splits: t.treadmill ? undefined : finalSplits(t, end),
      route: t.treadmill ? undefined : t.points.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, ...(p.alt != null ? { alt: Math.round(p.alt) } : {}) })),
      ...(strapHr && (a.hrSamples?.length ?? 0) >= 6 ? { avgHr: strapHr.avg, maxHr: strapHr.max, hrSource: 'strap' as const } : {}),
    });
    run.clear();
    void cancelTodayNudge(toDateKey());
    void syncActivityToHealth(activityId).then(() => syncActivityToStrava(activityId));
    router.replace(`/summary/${activityId}`);
  };

  const discard = () =>
    confirmDialog('Discard this session?', 'Nothing will be saved. No XP lost — it just won’t count.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await stopTracking();
          stopSpeaking();
          liveStats.end({ title: 'Session discarded', subtitle: 'No problem — see you next time.' });
          void hrStrap.disconnect();
          run.clear();
          close();
        },
      },
    ]);

  const finish = () => {
    const a = useRunStore.getState().active;
    if (!a) return;
    if (!a.tracker.paused) run.pause();
    if (movingMs(a.tracker, Date.now()) < 60_000) {
      confirmDialog('That was under a minute', 'Save it anyway, or discard?', [
        { text: 'Resume', onPress: () => run.resume() },
        { text: 'Discard', style: 'destructive', onPress: discard },
        { text: 'Save', web: true, onPress: () => (a.tracker.treadmill ? setFinishing(true) : void save()) },
      ]);
      return;
    }
    if (a.tracker.treadmill) setFinishing(true);
    else void save();
  };

  // ── pre-start ──
  if (!active) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{session ? 'Planned session' : 'Extra run'}</Small>
          <Button kind="ghost" title="Close" onPress={close} />
        </Row>
        <H1>{session?.title ?? 'Easy run'}</H1>
        <Body muted>{session ? sessionSubtitle(session, profile, currentPaces(useStore.getState().app)) : 'Unplanned runs earn a little XP. Keep it easy — your plan has your back.'}</Body>
        {session?.walkRun ? (
          <Card>
            <H3>How it goes</H3>
            <Body>• Walk {session.walkRun.warmupMin} min to warm up</Body>
            <Body>
              • Then {session.walkRun.repeats}× run {session.walkRun.runSec < 60 ? `${session.walkRun.runSec} sec` : `${session.walkRun.runSec / 60} min`}, walk{' '}
              {session.walkRun.walkSec < 60 ? `${session.walkRun.walkSec} sec` : `${session.walkRun.walkSec / 60} min`}
            </Body>
            <Body>• Walk {session.walkRun.cooldownMin} min to cool down</Body>
            <Small>Voice prompts tell you when to switch — no need to look at your phone.</Small>
          </Card>
        ) : null}
        {session?.workout ? (
          <Card>
            <H3>How it goes</H3>
            <Body>• {session.workout.warmupMin} min easy jog to warm up</Body>
            <Body>
              • {session.workout.repeats} × {session.workout.runSec / 60} min {session.runType === 'tempo' ? 'comfortably hard' : session.runType === 'hills' ? 'strong uphill' : 'at about 5K effort'}
              {session.targetPaceSecPerKm ? ` (~${paceLabel(session.targetPaceSecPerKm, units)}/${units}, from your PBs)` : ''}, with {session.workout.walkSec / 60} min easy jog between
            </Body>
            <Body>• {session.workout.cooldownMin} min easy to cool down</Body>
            <Small>Hit the effort, not the number. If it feels too hard, slow down — the plan adapts.</Small>
          </Card>
        ) : null}
        {session?.note ? <Small style={{ fontStyle: 'italic' }}>{session.note}</Small> : null}
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <H3>Treadmill</H3>
              <Small>No GPS; enter distance at the end if you like.</Small>
            </View>
            <Switch value={treadmill} onValueChange={setTreadmill} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <H3>Keep screen on</H3>
              <Small>Optional — recording works with the screen off too.</Small>
            </View>
            <Switch value={keepAwake} onValueChange={setKeepAwake} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <H3>Voice cues</H3>
              <Small>Interval prompts and the occasional gentle reminder.</Small>
            </View>
            <Switch value={profile.audioCues} onValueChange={(v) => useStore.getState().updateProfile({ audioCues: v })} />
          </Row>
        </Card>
        <Button big title="Start" onPress={() => void begin()} />
      </Screen>
    );
  }

  // ── treadmill finish ──
  if (finishing) {
    return (
      <Screen edges={['top', 'bottom']}>
        <H1>Nice work</H1>
        <Body muted>Treadmill distance (optional)</Body>
        <TextInput
          value={treadmillKm}
          onChangeText={setTreadmillKm}
          keyboardType="decimal-pad"
          placeholder={`e.g. 3.2 ${units}`}
          placeholderTextColor={c.textMuted}
          style={{ ...font.h2, color: c.text, backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: c.border }}
        />
        <Button big title="Save session" onPress={() => void save()} />
        <Button kind="ghost" title="Back to session" onPress={() => { setFinishing(false); run.resume(); }} />
      </Screen>
    );
  }

  // ── active ──
  const t = active.tracker;
  const elapsed = movingMs(t, now) / 1000;
  const plannedSec = (session?.durationMin ?? 0) * 60;
  const structure = session?.walkRun ?? session?.workout;
  const phase = structure ? walkRunPhase(structure, elapsed) : null;
  const pace = t.treadmill ? null : currentPace(t, now);
  const avg = t.treadmill ? null : averagePace(t.distanceM, elapsed, units);
  const phaseColor = phase?.phase === 'run' ? c.primary : phase?.phase === 'walk' ? c.rest : c.accent;
  const phaseLabel: Record<string, string> = session?.workout
    ? {
        warmup: 'WARM-UP JOG',
        run: session.runType === 'tempo' ? 'TEMPO' : session.runType === 'hills' ? 'UPHILL' : 'HARD',
        walk: session.runType === 'hills' ? 'JOG DOWN' : 'EASY JOG',
        cooldown: 'COOL-DOWN',
        done: 'ALL DONE',
      }
    : { warmup: 'WARM-UP WALK', run: 'RUN', walk: 'WALK', cooldown: 'COOL-DOWN WALK', done: 'ALL DONE' };

  const liveHr = active.hr && now - active.hr.t < 15_000 ? active.hr.bpm : null;
  const gpsLabel = t.paused
    ? 'Paused'
    : t.treadmill
      ? 'Treadmill'
      : active.gpsMode === 'background'
        ? 'GPS ● Recording'
        : active.gpsMode === 'foreground'
          ? 'GPS ● Keep app open'
          : 'No GPS';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {active.title}
        </Text>
        <Text style={{ color: t.paused ? c.accent : c.primary, fontWeight: '700', fontSize: 13 }}>{gpsLabel}</Text>
      </View>
      {gpsError ? <Small style={{ color: c.danger, paddingHorizontal: space.lg, paddingBottom: space.sm }}>{gpsError}</Small> : null}

      {!t.treadmill ? (
        <View style={{ flex: 1 }}>
          <LiveMap points={t.points} />
        </View>
      ) : null}

      {phase ? (
        <View style={{ backgroundColor: phaseColor, paddingVertical: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} accessibilityLiveRegion="polite">
          <View>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{phaseLabel[phase.phase]}</Text>
            {phase.repeat > 0 && phase.phase !== 'done' ? (
              <Text style={{ color: '#fff', opacity: 0.9 }}>
                {session?.workout ? 'Rep' : 'Interval'} {phase.repeat} of {structure!.repeats}
              </Text>
            ) : null}
          </View>
          <Text style={[font.big, { color: '#fff' }]}>{formatDuration(phase.remainingSec)}</Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg, flex: t.treadmill ? 1 : undefined }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: c.textMuted, fontWeight: '500' }}>Time</Text>
          <Text style={[font.huge, { color: c.text }]} accessibilityLabel={`Time ${formatDuration(elapsed)}`}>
            {formatDuration(elapsed)}
          </Text>
        </View>
        <StatRow>
          <Stat big center label={`Distance (${units})`} value={t.treadmill ? '—' : (t.distanceM / METERS_PER_UNIT[units]).toFixed(2)} />
          <Stat big center label={`Pace (/${units})`} value={formatPace(pace ?? avg, units).split(' ')[0]} />
          {liveHr ? <Stat big center label={active.hr?.source === 'strap' ? 'Heart rate' : 'HR (watch)'} value={String(liveHr)} /> : null}
        </StatRow>
        {active.strapStatus === 'lost' ? <Small style={{ textAlign: 'center', color: c.danger }}>Heart-rate strap disconnected — check it’s on and wet.</Small> : null}
        {active.strapStatus === 'connecting' ? <Small style={{ textAlign: 'center' }}>Connecting to your heart-rate strap…</Small> : null}
        {plannedSec > 0 && !phase ? (
          <View style={{ gap: 4 }}>
            <ProgressBar value={elapsed / plannedSec} />
            <Small style={{ textAlign: 'center' }}>
              {elapsed >= plannedSec ? 'Planned time done — finish whenever you like.' : `${formatDuration(plannedSec - elapsed)} to go`}
            </Small>
          </View>
        ) : null}
        {t.splits.length ? (
          <Small style={{ textAlign: 'center' }}>
            Last split {formatDuration(t.splits[t.splits.length - 1].durationSec)} /{units}
          </Small>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: space.xxl, paddingVertical: space.xl }}>
        {t.paused ? (
          <>
            <RoundButton label="Resume" onPress={() => run.resume()} icon={<Ionicons name="play" size={32} color={c.primaryText} style={{ marginLeft: 4 }} />} />
            <RoundButton label="Finish" kind="neutral" onPress={finish} icon={<Ionicons name="flag" size={28} color={c.text} />} />
          </>
        ) : (
          <RoundButton label="Pause" kind="neutral" size={92} onPress={() => run.pause()} icon={<Ionicons name="pause" size={34} color={c.text} />} />
        )}
      </View>
      {t.paused ? <Button kind="ghost" title="Discard session" onPress={discard} style={{ marginBottom: space.md }} /> : null}
    </SafeAreaView>
  );
}

// ───────────────────────────── strength ─────────────────────────────

function StrengthSession({ session }: { session: PlannedSession }) {
  const c = useColors();
  const completeSession = useStore((s) => s.completeSession);
  const routine = routineById(session.routineId);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const now = useNow(startedAt !== null);
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;

  const save = () => {
    const end = Date.now();
    const activityId = completeSession({
      plannedSessionId: session.id,
      kind: 'strength',
      title: session.title,
      startedAt: startedAt ?? end,
      endedAt: end,
      durationSec: startedAt ? (end - startedAt) / 1000 : session.durationMin * 60,
      routineId: session.routineId,
    });
    void cancelTodayNudge(toDateKey());
    void syncActivityToHealth(activityId).then(() => syncActivityToStrava(activityId));
    router.replace(`/summary/${activityId}`);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>{session.replacedFrom ? 'Swapped in for a run' : session.optional ? 'Optional session' : 'Planned session'}</Small>
        <Button kind="ghost" title="Close" onPress={close} />
      </Row>
      <H1>{session.title}</H1>
      <Body muted>{sessionSubtitle(session, useStore.getState().app.profile, currentPaces(useStore.getState().app))}</Body>
      {startedAt ? <H2>{formatDuration(elapsed)}</H2> : null}
      {routine?.exercises.map((e, i) => {
        const checked = done.includes(i);
        return (
          <Card key={e.name} onPress={startedAt ? () => setDone((d) => (checked ? d.filter((x) => x !== i) : [...d, i])) : undefined} style={checked ? { backgroundColor: c.primarySoft } : undefined}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flex: 1 }}>
                <H3>{e.name}</H3>
                <Small>{e.dose} · {e.cue}</Small>
              </View>
              {startedAt ? <Chip label={checked ? '✓' : ' '} selected={checked} onPress={() => setDone((d) => (checked ? d.filter((x) => x !== i) : [...d, i]))} /> : null}
            </Row>
          </Card>
        );
      })}
      {startedAt ? (
        <Button big title={done.length === (routine?.exercises.length ?? 0) ? 'Finish session' : 'Finish (that’s enough today)'} onPress={save} />
      ) : (
        <Button
          big
          title="Start"
          onPress={() => {
            setStartedAt(Date.now());
            speak(`Let's go. ${routine?.exercises[0]?.name ?? ''}.`);
          }}
        />
      )}
      <Small style={{ textAlign: 'center' }}>Move slowly and comfortably. Skip anything that doesn’t feel right.</Small>
    </Screen>
  );
}
