import { Text, View } from 'react-native';
import { rangeKeys, weekdayShort } from '../domain/dates';
import type { DateKey, PlanWeek } from '../domain/types';
import { useColors } from '../theme';

/** Seven circles for the plan week: filled = done, ring = planned, soft = rest. Missed days are just empty — no red. */
export function WeekStrip({ week, today }: { week: PlanWeek; today: DateKey }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {rangeKeys(week.start, week.end).map((d) => {
        const sessions = week.sessions.filter((s) => s.date === d && s.status !== 'dropped');
        const core = sessions.filter((s) => !s.optional);
        const done = sessions.some((s) => s.status === 'completed');
        const planned = core.length > 0;
        const paused = sessions.some((s) => s.status === 'paused');
        const isToday = d === today;
        const bg = done ? c.primary : 'transparent';
        const border = done ? c.primary : planned ? (d < today ? c.missed : c.primary) : c.border;
        const label = done ? 'done' : paused ? 'paused' : planned ? (d < today ? 'not done' : 'planned') : 'rest';
        return (
          <View key={d} style={{ alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${weekdayShort(d)}: ${label}`}>
            <Text style={{ fontSize: 12, color: isToday ? c.text : c.textMuted, fontWeight: isToday ? '700' : '500' }}>{weekdayShort(d)}</Text>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: planned || done ? 2.5 : 1,
                borderStyle: paused ? 'dashed' : 'solid',
                borderColor: border,
                backgroundColor: bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done ? <Text style={{ color: c.primaryText, fontWeight: '800' }}>✓</Text> : null}
              {!planned && !done ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.rest }} /> : null}
            </View>
            {isToday ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.text }} /> : <View style={{ height: 4 }} />}
          </View>
        );
      })}
    </View>
  );
}
