/** Pair a Bluetooth heart-rate strap. */
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Body, Button, Card, H3, Option, OptionGroup, Screen, Small } from '../components/ui';
import { hrStrap, type FoundDevice } from '../services/heartRate';
import { useStore } from '../state/store';
import { space, useColors } from '../theme';

export default function Devices() {
  const c = useColors();
  const current = useStore((s) => s.app.profile?.hrDevice);
  const update = useStore((s) => s.updateProfile);
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<{ id: string; bpm: number | null } | null>(null);
  const stop = useRef<() => void>(() => {});

  const scan = async () => {
    setFound([]);
    setError(null);
    setScanning(true);
    stop.current = await hrStrap.scan((d) => setFound((f) => (f.some((x) => x.id === d.id) ? f : [...f, d])), (m) => setError(m));
    setTimeout(() => setScanning(false), 15_000);
  };

  useEffect(() => {
    if (hrStrap.supported) void scan();
    return () => {
      stop.current();
      void hrStrap.disconnect();
    };
  }, []);

  const choose = async (d: FoundDevice) => {
    stop.current();
    setScanning(false);
    setTesting({ id: d.id, bpm: null });
    try {
      await hrStrap.connect(d.id, (bpm) => setTesting({ id: d.id, bpm }), () => undefined);
      update({ hrDevice: { id: d.id, name: d.name } });
    } catch (e) {
      setError((e as Error).message);
      setTesting(null);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Heart-rate strap' }} />
      {!hrStrap.supported ? (
        <Card>
          <Body muted>Bluetooth straps work in the iPhone and Android app, not in this preview.</Body>
        </Card>
      ) : (
        <>
          <Small>Put the strap on (a damp strap connects faster). Any standard Bluetooth heart-rate monitor works: Polar, Garmin HRM, Wahoo, Coros and more.</Small>
          {current ? (
            <Card>
              <H3>Paired: {current.name}</H3>
              <Small>Steady connects to it automatically when you start a run.</Small>
              <Button kind="ghost" title="Forget this strap" onPress={() => update({ hrDevice: undefined })} />
            </Card>
          ) : null}
          {testing ? (
            <Card>
              <H3>{testing.bpm ? `♥ ${testing.bpm} bpm — it’s working` : 'Connecting…'}</H3>
              {testing.bpm ? <Button title="Done" onPress={() => router.back()} /> : <ActivityIndicator color={c.primary} />}
            </Card>
          ) : null}
          <OptionGroup>
            {found.map((d) => (
              <Option key={d.id} label={d.name} description={d.rssi ? `Signal ${d.rssi} dBm` : undefined} selected={current?.id === d.id || testing?.id === d.id} onPress={() => void choose(d)} />
            ))}
          </OptionGroup>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center' }}>
            {scanning ? <ActivityIndicator color={c.primary} /> : null}
            <Small>{scanning ? 'Looking for straps…' : found.length ? `${found.length} found` : 'None found yet.'}</Small>
          </View>
          {!scanning ? <Button kind="secondary" title="Scan again" onPress={() => void scan()} /> : null}
          {error ? <Small style={{ color: c.danger, textAlign: 'center' }}>{error}</Small> : null}
          <Small style={{ textAlign: 'center' }}>Apple Watch? Start a workout on the watch too — Steady reads its heart rate from Apple Health during your run.</Small>
        </>
      )}
    </Screen>
  );
}
