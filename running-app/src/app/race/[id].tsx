/** Add or edit a race: pick a popular one or type your own, set the date, and say whether it's a PB attempt. */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Body, Button, Card, Chip, H3, Option, OptionGroup, Row, Screen, SectionTitle, Small } from '../../components/ui';
import { addDays, diffDays, formatShort, fromDateKey, toDateKey, weekdayLong } from '../../domain/dates';
import { uid } from '../../domain/engine';
import { currentFiveK } from '../../domain/fitness';
import { formatTime, parseTime, predictTime, RACE_METERS } from '../../domain/pace';
import { searchCatalog, usualWhen, type CatalogRace } from '../../domain/raceCatalog';
import { nearestStandard, recoveryDays, taperDays } from '../../domain/races';
import type { Race, RaceTerrain } from '../../domain/types';
import { confirmDialog } from '../../services/dialog';
import { today as getToday, useStore } from '../../state/store';
import { font, radius, space, useColors } from '../../theme';

const DISTANCES: { label: string; m: number }[] = [
  { label: '5K', m: 5000 },
  { label: '10K', m: 10000 },
  { label: 'Half', m: 21097.5 },
  { label: 'Marathon', m: 42195 },
];
const TERRAIN: { id: RaceTerrain; label: string }[] = [
  { id: 'road', label: 'Road' },
  { id: 'trail', label: 'Trail' },
  { id: 'track', label: 'Track' },
  { id: 'cross_country', label: 'Cross-country' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

export default function RaceEditor() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useStore((s) => s.app);
  const save = useStore((s) => s.saveRace);
  const remove = useStore((s) => s.removeRace);
  const existing = (app.races ?? []).find((r) => r.id === id);
  const today = getToday();

  const [query, setQuery] = useState('');
  const [catalogId, setCatalogId] = useState<string | undefined>(existing?.catalogId);
  const [name, setName] = useState(existing?.name ?? '');
  const [distanceM, setDistanceM] = useState<number>(existing?.distanceM ?? 0);
  const [customKm, setCustomKm] = useState(existing && !DISTANCES.some((d) => d.m === existing.distanceM) ? String(existing.distanceM / 1000) : '');
  const [terrain, setTerrain] = useState<RaceTerrain>(existing?.terrain ?? 'road');
  const [pbAttempt, setPbAttempt] = useState(existing?.pbAttempt ?? true);
  const [goalText, setGoalText] = useState(existing?.goalTimeSec ? formatTime(existing.goalTimeSec) : '');
  const initial = existing ? fromDateKey(existing.date) : fromDateKey(addDays(today, 56));
  const [ym, setYm] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const [day, setDay] = useState(initial.getDate());
  const [pickingCatalog, setPickingCatalog] = useState(!existing);

  const months = useMemo(() => {
    const t = fromDateKey(today);
    return Array.from({ length: 13 }, (_, i) => {
      const d = new Date(t.getFullYear(), t.getMonth() + i, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }, [today]);
  const maxDay = daysInMonth(ym.y, ym.m);
  const date = toDateKey(new Date(ym.y, ym.m, Math.min(day, maxDay)));
  const fiveK = currentFiveK(app);
  const predicted = fiveK && distanceM ? predictTime(fiveK, nearestStandard(distanceM)) * (distanceM / RACE_METERS[nearestStandard(distanceM)]) : null;
  const goalSec = parseTime(goalText) ?? undefined;
  const valid = name.trim().length > 0 && distanceM >= 1000 && date >= today;
  const weeksOut = Math.ceil(diffDays(today, date) / 7);

  const shiftWeek = (n: number) => {
    const d = fromDateKey(addDays(date, n));
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setDay(d.getDate());
  };

  const pickCatalog = (r: CatalogRace) => {
    setCatalogId(r.id);
    setName(r.name);
    setDistanceM(r.distanceM);
    setTerrain(r.terrain);
    setCustomKm('');
    if (r.id === 'parkrun') {
      // Next Saturday.
      const sat = addDays(today, (5 - ((fromDateKey(today).getDay() + 6) % 7) + 7) % 7 || 7);
      const d = fromDateKey(sat);
      setYm({ y: d.getFullYear(), m: d.getMonth() });
      setDay(d.getDate());
    } else if (r.usualMonth) {
      const next = months.find((x) => x.m === r.usualMonth! - 1);
      if (next) {
        setYm(next);
        // Big races are almost always on a weekend: default to the Sunday on/after the 15th.
        const fifteenth = new Date(next.y, next.m, 15);
        setDay(15 + ((7 - fifteenth.getDay()) % 7));
      }
    }
    setPickingCatalog(false);
  };

  const submit = () => {
    if (!valid) return;
    const race: Race = {
      id: existing?.id ?? uid('race'),
      name: name.trim(),
      date,
      distanceM,
      terrain,
      pbAttempt,
      goalTimeSec: pbAttempt ? goalSec : undefined,
      catalogId,
      result: existing?.result,
    };
    save(race);
    router.back();
  };

  const input = { ...font.h3, color: c.text, backgroundColor: c.surfaceAlt, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: space.lg };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Edit race' : 'Add a race' }} />

      {pickingCatalog ? (
        <>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search popular races" placeholderTextColor={c.textMuted} style={input} accessibilityLabel="Search popular races" />
          <OptionGroup>
            {searchCatalog(query).map((r) => (
              <Option key={r.id} label={r.name} description={`${r.place} · ${DISTANCES.find((d) => d.m === r.distanceM)?.label ?? `${r.distanceM / 1000} km`} · ${usualWhen(r)}`} selected={catalogId === r.id} onPress={() => pickCatalog(r)} />
            ))}
          </OptionGroup>
          <Button kind="secondary" title="It’s not listed — add my own" onPress={() => { setCatalogId(undefined); setPickingCatalog(false); }} />
        </>
      ) : (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Small>{catalogId ? 'From popular races' : 'Your race'}</Small>
              <Button kind="ghost" title="Search popular races" onPress={() => setPickingCatalog(true)} />
            </Row>
            <TextInput value={name} onChangeText={setName} placeholder="Race name" placeholderTextColor={c.textMuted} style={input} accessibilityLabel="Race name" />
            {catalogId && catalogId !== 'parkrun' ? <Small>Dates change each year — check the official site and set the date below.</Small> : null}
          </Card>

          <SectionTitle>Date</SectionTitle>
          <Card>
            <Row>
              {months.map((mo) => (
                <Chip key={`${mo.y}-${mo.m}`} label={`${MONTHS[mo.m]}${mo.y !== fromDateKey(today).getFullYear() ? ` ’${String(mo.y).slice(2)}` : ''}`} selected={mo.y === ym.y && mo.m === ym.m} onPress={() => setYm(mo)} />
              ))}
            </Row>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Button kind="secondary" title="−" onPress={() => setDay(Math.max(1, Math.min(day, maxDay) - 1))} />
              <View style={{ alignItems: 'center' }}>
                <H3>
                  {weekdayLong(date)} {formatShort(date)}
                </H3>
                <Small>{date < today ? 'That’s in the past' : weeksOut <= 1 ? 'This week' : `${weeksOut} weeks away`}</Small>
              </View>
              <Button kind="secondary" title="+" onPress={() => setDay(Math.min(maxDay, Math.min(day, maxDay) + 1))} />
            </Row>
            <Row style={{ justifyContent: 'center' }}>
              <Button kind="ghost" title="− 1 week" onPress={() => shiftWeek(-7)} />
              <Button kind="ghost" title="+ 1 week" onPress={() => shiftWeek(7)} />
            </Row>
          </Card>

          <SectionTitle>Distance & terrain</SectionTitle>
          <Card>
            <Row>
              {DISTANCES.map((d) => (
                <Chip key={d.label} label={d.label} selected={distanceM === d.m && !customKm} onPress={() => { setDistanceM(d.m); setCustomKm(''); }} />
              ))}
            </Row>
            <Row style={{ flexWrap: 'nowrap' }}>
              <Small>Other:</Small>
              <TextInput
                value={customKm}
                onChangeText={(v) => {
                  setCustomKm(v);
                  const km = parseFloat(v.replace(',', '.'));
                  if (isFinite(km) && km > 0) setDistanceM(Math.round(km * 1000));
                }}
                placeholder="km, e.g. 16"
                placeholderTextColor={c.textMuted}
                keyboardType="decimal-pad"
                style={[input, { flex: 1 }]}
                accessibilityLabel="Custom distance in kilometres"
              />
            </Row>
            <Row>
              {TERRAIN.map((t) => (
                <Chip key={t.id} label={t.label} selected={terrain === t.id} onPress={() => setTerrain(t.id)} />
              ))}
            </Row>
          </Card>

          <SectionTitle>What’s the plan for this race?</SectionTitle>
          <OptionGroup>
            <Option
              label="PB attempt"
              description="Your plan builds toward it: race-pace sessions, longer long runs, a proper taper and recovery."
              selected={pbAttempt}
              onPress={() => setPbAttempt(true)}
            />
            <Option label="Just for fun / training" description="Fits around your normal plan, with a lighter few days before." selected={!pbAttempt} onPress={() => setPbAttempt(false)} />
          </OptionGroup>

          {pbAttempt && distanceM ? (
            <Card>
              <H3>Goal time (optional)</H3>
              <Small>{predicted ? `Current estimate: ${formatTime(predicted)}. Leave blank to train from your fitness.` : 'Leave blank to train by effort.'}</Small>
              <TextInput value={goalText} onChangeText={setGoalText} placeholder={predicted ? formatTime(predicted * 0.98) : 'h:mm:ss'} placeholderTextColor={c.textMuted} keyboardType="numbers-and-punctuation" style={input} accessibilityLabel="Goal time" />
            </Card>
          ) : null}

          {distanceM && date >= today ? (
            <Small>
              {pbAttempt
                ? `Taper: ${taperDays({ distanceM } as Race)} days. Recovery afterwards: about ${recoveryDays({ distanceM, terrain, pbAttempt } as Race)} days of easy running.`
                : `A lighter couple of days before, then about ${recoveryDays({ distanceM, terrain, pbAttempt } as Race)} easy day${recoveryDays({ distanceM, terrain, pbAttempt } as Race) === 1 ? '' : 's'} after.`}
              {weeksOut < 6 && pbAttempt && distanceM > 20000 ? ' It’s close — the plan will make the most of the time without cramming.' : ''}
            </Small>
          ) : null}

          <Button big title={existing ? 'Save race' : 'Add race'} onPress={submit} disabled={!valid} />
          {existing ? (
            <Button
              kind="ghost"
              title="Delete race"
              onPress={() =>
                confirmDialog('Delete this race?', 'Your plan will go back to normal around that date.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { remove(existing.id); router.back(); } },
                ])
              }
            />
          ) : null}
          {!valid && name.trim() && distanceM < 1000 ? <Body muted>Pick a distance.</Body> : null}
        </>
      )}
    </Screen>
  );
}
