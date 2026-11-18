/** Share a run with friends: preview the card, choose what to show, send via the phone's share sheet. */
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ShareCard } from '../../components/ShareCard';
import { Body, Button, Chip, Row, Screen, SectionTitle, Small } from '../../components/ui';
import { countsTowardCompletion, planStreak } from '../../domain/metrics';
import { defaultShareOptions, shareText, type ShareOptions } from '../../domain/share';
import { today as getToday, useStore } from '../../state/store';
import { space, useColors } from '../../theme';

export default function ShareRun() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useStore((s) => s.app);
  const a = app.activities.find((x) => x.id === id);
  const p = app.profile;
  // Host view instance; typed loosely because RN 0.88 types `View` as a function component.
  const cardRef = useRef<any>(null);
  const [o, setO] = useState<ShareOptions>(() => defaultShareOptions(p?.level ?? 'new', !!a?.route?.length));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ctx = useMemo(() => {
    const week = app.plan?.weeks.find((w) => a && w.start <= a.date && a.date <= w.end);
    const core = week?.sessions.filter(countsTowardCompletion) ?? [];
    return {
      units: p?.units ?? 'km',
      division: app.rank.division,
      streak: planStreak(app, getToday()),
      weekDone: core.filter((s) => s.status === 'completed').length,
      weekTotal: core.length,
    };
  }, [app, a, p]);

  if (!a || !p) return <Screen><Body>Run not found.</Body></Screen>;

  const toggle = (k: keyof ShareOptions) => setO((cur) => ({ ...cur, [k]: !cur[k] }));
  const message = shareText(a, o, ctx);

  const shareImage = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, width: 1080, height: 1350, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your run', UTI: 'public.png' });
      } else {
        await Share.share({ message });
      }
    } catch {
      setStatus('Couldn’t create the image. Try sharing as text.');
    } finally {
      setBusy(false);
    }
  };

  const shareTextOnly = async () => {
    setStatus(null);
    try {
      await Share.share({ message });
    } catch {
      try {
        await navigator.clipboard.writeText(message);
        setStatus('Copied — paste it into a message to a friend.');
      } catch {
        setStatus('Sharing isn’t available here. On your phone this opens the share sheet.');
      }
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Share with friends' }} />
      <View style={{ alignItems: 'center', paddingVertical: space.sm }}>
        <ShareCard a={a} o={o} ctx={ctx} hideEnds={p.hideRouteEnds} viewRef={cardRef} />
      </View>

      <SectionTitle>Show on the card</SectionTitle>
      <Row>
        {a.distanceM ? <Chip label="Distance" selected={o.showDistance} onPress={() => toggle('showDistance')} /> : null}
        {a.distanceM ? <Chip label="Pace" selected={o.showPace} onPress={() => toggle('showPace')} /> : null}
        {a.route?.length ? <Chip label="Route" selected={o.showRoute} onPress={() => toggle('showRoute')} /> : null}
        <Chip label="Rank" selected={o.showRank} onPress={() => toggle('showRank')} />
        <Chip label="Streak & week" selected={o.showStreak} onPress={() => toggle('showStreak')} />
      </Row>
      {a.route?.length && o.showRoute ? (
        <Small>{p.hideRouteEnds ? 'The start and end of your route are trimmed so your home isn’t shown.' : 'Your full route is shown, including where you started. You can hide route ends in Plan → Runs.'}</Small>
      ) : null}

      {Platform.OS !== 'web' ? <Button big title={busy ? 'Preparing…' : 'Share image'} onPress={() => void shareImage()} disabled={busy} /> : null}
      <Button kind={Platform.OS === 'web' ? 'primary' : 'secondary'} big={Platform.OS === 'web'} title="Share as text" onPress={() => void shareTextOnly()} />
      {status ? <Small style={{ color: status.startsWith('Copied') ? c.primary : c.danger, textAlign: 'center' }}>{status}</Small> : null}
      <Small style={{ textAlign: 'center' }}>Nothing is posted anywhere. You choose who gets it.</Small>
    </Screen>
  );
}
