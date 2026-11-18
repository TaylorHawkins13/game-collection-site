/** Compact date picker: month chips, ±1 day and ±1 week. Never goes before `min`. */
import { View } from 'react-native';
import { addDays, formatShort, fromDateKey, toDateKey, weekdayLong } from '../domain/dates';
import type { DateKey } from '../domain/types';
import { space } from '../theme';
import { Button, Chip, H3, Row, Small } from './ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DatePicker({ value, onChange, min, months = 6, hint }: { value: DateKey; onChange: (d: DateKey) => void; min: DateKey; months?: number; hint?: string }) {
  const minD = fromDateKey(min);
  const cur = fromDateKey(value);
  const clampTo = (d: DateKey) => (d < min ? min : d);
  return (
    <View style={{ gap: space.sm }}>
      <Row>
        {Array.from({ length: months }, (_, i) => new Date(minD.getFullYear(), minD.getMonth() + i, 1)).map((m) => {
          const on = m.getFullYear() === cur.getFullYear() && m.getMonth() === cur.getMonth();
          return (
            <Chip
              key={`${m.getFullYear()}-${m.getMonth()}`}
              label={`${MONTHS[m.getMonth()]}${m.getFullYear() !== minD.getFullYear() ? ` ’${String(m.getFullYear()).slice(2)}` : ''}`}
              selected={on}
              onPress={() => {
                const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
                onChange(clampTo(toDateKey(new Date(m.getFullYear(), m.getMonth(), Math.min(cur.getDate(), last)))));
              }}
            />
          );
        })}
      </Row>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Button kind="secondary" title="−" onPress={() => onChange(clampTo(addDays(value, -1)))} disabled={value <= min} />
        <View style={{ alignItems: 'center' }}>
          <H3>
            {weekdayLong(value)} {formatShort(value)}
          </H3>
          {hint ? <Small>{hint}</Small> : null}
        </View>
        <Button kind="secondary" title="+" onPress={() => onChange(addDays(value, 1))} />
      </Row>
      <Row style={{ justifyContent: 'center' }}>
        <Button kind="ghost" title="− 1 week" onPress={() => onChange(clampTo(addDays(value, -7)))} disabled={value <= min} />
        <Button kind="ghost" title="+ 1 week" onPress={() => onChange(addDays(value, 7))} />
      </Row>
    </View>
  );
}

export function startOptions(today: DateKey): { label: string; date: DateKey; note?: string }[] {
  const t = fromDateKey(today);
  const wd = (t.getDay() + 6) % 7; // 0 = Monday
  const nextMonday = addDays(today, wd === 0 ? 7 : 7 - wd);
  const opts: { label: string; date: DateKey; note?: string }[] = [
    { label: 'Today', date: today, note: 'Your first session is today.' },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next Monday', date: nextMonday, note: 'A clean week to start.' },
  ];
  const jan1 = `${t.getMonth() >= 10 ? t.getFullYear() + 1 : t.getFullYear()}-01-01`;
  if (jan1 > today && jan1 <= addDays(today, 62)) opts.push({ label: '1 January', date: jan1, note: 'New year, fresh start.' });
  return opts;
}
