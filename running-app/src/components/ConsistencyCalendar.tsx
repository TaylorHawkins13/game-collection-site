import { Text, View } from 'react-native';
import { addDays, weekday, weekStartMonday } from '../domain/dates';
import { calendar } from '../domain/metrics';
import type { AppState, DateKey } from '../domain/types';
import { useColors } from '../theme';

/** GitHub-style grid of the season so far: Monday-first rows of weeks. */
export function ConsistencyCalendar({ state, from, to, today }: { state: AppState; from: DateKey; to: DateKey; today: DateKey }) {
  const c = useColors();
  const start = weekStartMonday(from);
  const days = calendar(state, start, to, today);
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const color = (s: string) =>
    s === 'done' ? c.primary : s === 'extra' ? c.primarySoft : s === 'paused' ? c.rest : s === 'planned' ? c.surface : c.surfaceAlt;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: c.textMuted }}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0].date} style={{ flexDirection: 'row', gap: 4 }}>
          {w.map((d) => (
            <View
              key={d.date}
              accessible
              accessibilityLabel={`${d.date}: ${d.state}`}
              style={{
                flex: 1,
                aspectRatio: 1,
                borderRadius: 999,
                backgroundColor: d.date < from ? 'transparent' : color(d.state),
                borderWidth: d.state === 'planned' || d.date === today ? 1.5 : 0,
                borderColor: d.date === today ? c.text : c.border,
              }}
            />
          ))}
          {w.length < 7 ? Array.from({ length: 7 - w.length }, (_, i) => <View key={i} style={{ flex: 1 }} />) : null}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {[
          ['Done', c.primary],
          ['Extra', c.primarySoft],
          ['Rest / not done', c.surfaceAlt],
          ['Paused', c.rest],
        ].map(([l, col]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col }} />
            <Text style={{ fontSize: 11, color: c.textMuted }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function seasonCalendarRange(seasonStart: DateKey, today: DateKey, planStart?: DateKey) {
  const from = planStart && planStart > seasonStart ? planStart : seasonStart;
  // Show through the end of the current week.
  const to = addDays(today, 6 - weekday(today));
  return { from, to };
}
