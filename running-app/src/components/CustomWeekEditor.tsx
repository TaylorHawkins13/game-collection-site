/** Build your own week: add sessions to each day, set their length, remove them. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { weekdayName } from '../domain/dates';
import type { CustomSlot } from '../domain/types';
import { radius, space, useColors } from '../theme';
import { Button, Card, Chip, H3, Row, Small } from './ui';

type SlotType = NonNullable<CustomSlot['runType']> | 'strength' | 'mobility';

const TYPES: { id: SlotType; label: string; defaultMin: number }[] = [
  { id: 'easy', label: 'Easy', defaultMin: 30 },
  { id: 'long', label: 'Long', defaultMin: 60 },
  { id: 'tempo', label: 'Tempo', defaultMin: 40 },
  { id: 'intervals', label: 'Intervals', defaultMin: 40 },
  { id: 'hills', label: 'Hills', defaultMin: 35 },
  { id: 'strides', label: 'Strides', defaultMin: 30 },
  { id: 'walk_run', label: 'Walk-run', defaultMin: 20 },
  { id: 'strength', label: 'Strength', defaultMin: 12 },
  { id: 'mobility', label: 'Mobility', defaultMin: 10 },
];

function slotLabel(s: CustomSlot): string {
  if (s.kind === 'strength') return `${s.routineId?.startsWith('mob') ? 'Mobility' : 'Strength'} ${s.durationMin}m`;
  return `${TYPES.find((t) => t.id === s.runType)?.label ?? 'Easy'} ${s.durationMin}m`;
}

export function CustomWeekEditor({ week, onChange }: { week: CustomSlot[]; onChange: (w: CustomSlot[]) => void }) {
  const c = useColors();
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [type, setType] = useState<SlotType>('easy');
  const [minutes, setMinutes] = useState(30);
  const [optional, setOptional] = useState(false);

  const add = (weekday: number) => {
    const slot: CustomSlot =
      type === 'strength' || type === 'mobility'
        ? { weekday, kind: 'strength', routineId: type === 'mobility' ? 'mob-reset' : 'str-foundation', durationMin: minutes, optional }
        : { weekday, kind: 'run', runType: type, durationMin: minutes, optional };
    onChange([...week, slot]);
    setAddingDay(null);
  };

  const runs = week.filter((s) => s.kind === 'run');
  const totalMin = runs.reduce((a, s) => a + s.durationMin, 0);

  return (
    <View style={{ gap: space.sm }}>
      <Small>
        {runs.length} run{runs.length === 1 ? '' : 's'} · {totalMin} min running a week. Steady still tracks your sessions, slots your races in and suggests easing off after soreness — it won’t change your plan otherwise.
      </Small>
      {[0, 1, 2, 3, 4, 5, 6].map((d) => {
        const slots = week.map((s, i) => ({ s, i })).filter(({ s }) => s.weekday === d);
        return (
          <Card key={d}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <H3 style={{ width: 48 }}>{weekdayName(d)}</H3>
              <Row style={{ flex: 1 }}>
                {slots.length === 0 ? <Small>Rest</Small> : null}
                {slots.map(({ s, i }) => (
                  <Pressable
                    key={i}
                    onPress={() => onChange(week.filter((_, k) => k !== i))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${slotLabel(s)}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: s.kind === 'run' ? c.primarySoft : c.surfaceAlt, paddingVertical: 6, paddingHorizontal: 12 }}
                  >
                    <Text style={{ color: c.text, fontWeight: '600' }}>
                      {slotLabel(s)}
                      {s.optional ? ' (opt.)' : ''}
                    </Text>
                    <Text style={{ color: c.textMuted }}>✕</Text>
                  </Pressable>
                ))}
              </Row>
              <Button kind="ghost" title={addingDay === d ? 'Close' : '+ Add'} onPress={() => setAddingDay(addingDay === d ? null : d)} />
            </Row>
            {addingDay === d ? (
              <View style={{ gap: space.sm }}>
                <Row>
                  {TYPES.map((t) => (
                    <Chip key={t.id} label={t.label} selected={type === t.id} onPress={() => { setType(t.id); setMinutes(t.defaultMin); }} />
                  ))}
                </Row>
                <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <Button kind="secondary" title="−5" onPress={() => setMinutes(Math.max(5, minutes - 5))} />
                  <H3>{minutes} min</H3>
                  <Button kind="secondary" title="+5" onPress={() => setMinutes(Math.min(240, minutes + 5))} />
                </Row>
                <Row>
                  <Chip label="Counts toward my week" selected={!optional} onPress={() => setOptional(false)} />
                  <Chip label="Optional" selected={optional} onPress={() => setOptional(true)} />
                </Row>
                <Button title={`Add to ${weekdayName(d)}`} onPress={() => add(d)} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
