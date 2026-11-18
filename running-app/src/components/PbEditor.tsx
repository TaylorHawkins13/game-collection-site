/** Enter personal bests (and an optional goal time); shows the training paces they produce. */
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import {
  formatTime,
  GOAL_DISTANCE,
  isFasterGoal,
  isPlausible,
  paceLabel,
  pacesFor,
  parseTime,
  predictTime,
  RACE_LABEL,
  suggestedGoalTime,
} from '../domain/pace';
import type { ExperienceLevel, GoalId, PbRecency, PersonalBest, RaceDistance, Units } from '../domain/types';
import { font, radius, space, useColors } from '../theme';
import { Card, Chip, H3, Row, Small } from './ui';

const DISTANCES: RaceDistance[] = ['5k', '10k', 'half', 'marathon'];
const RECENCY: { id: PbRecency; label: string }[] = [
  { id: 'recent', label: 'Last 12 months' },
  { id: 'one_two_years', label: '1–2 years ago' },
  { id: 'older', label: 'Longer ago' },
];
const PLACEHOLDER: Record<RaceDistance, string> = { '5k': 'e.g. 27:30', '10k': 'e.g. 58:00', half: 'e.g. 2:05:00', marathon: 'e.g. 4:30:00' };

export function PbEditor({
  pbs,
  onChange,
  level,
  goal,
  goalTimeSec,
  onGoalTime,
  units,
}: {
  pbs: PersonalBest[];
  onChange: (pbs: PersonalBest[]) => void;
  level: ExperienceLevel;
  goal: GoalId;
  goalTimeSec?: number;
  onGoalTime: (sec: number | undefined) => void;
  units: Units;
}) {
  const c = useColors();
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(pbs.map((p) => [p.distance, formatTime(p.timeSec)])),
  );
  const [goalText, setGoalText] = useState(goalTimeSec ? formatTime(goalTimeSec) : '');
  const paces = pacesFor(pbs, level);
  const goalDistance = GOAL_DISTANCE[goal];
  const suggestion = suggestedGoalTime(pbs, level, goal);

  const setTime = (d: RaceDistance, value: string) => {
    setText((t) => ({ ...t, [d]: value }));
    const sec = parseTime(value);
    const existing = pbs.find((p) => p.distance === d);
    const rest = pbs.filter((p) => p.distance !== d);
    if (sec && isPlausible({ distance: d, timeSec: sec, recency: 'recent' })) {
      onChange([...rest, { distance: d, timeSec: sec, recency: existing?.recency ?? 'recent' }]);
    } else {
      onChange(rest);
    }
  };
  const setRecency = (d: RaceDistance, r: PbRecency) => onChange(pbs.map((p) => (p.distance === d ? { ...p, recency: r } : p)));

  const inputStyle = {
    ...font.h3,
    color: c.text,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: space.lg,
    minWidth: 130,
    textAlign: 'center' as const,
  };

  return (
    <View style={{ gap: space.sm }}>
      {DISTANCES.map((d) => {
        const value = text[d] ?? '';
        const pb = pbs.find((p) => p.distance === d);
        const invalid = value.trim() !== '' && !pb;
        return (
          <Card key={d}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flex: 1 }}>
                <H3>{RACE_LABEL[d]}</H3>
              </View>
              <TextInput
                value={value}
                onChangeText={(v) => setTime(d, v)}
                placeholder={PLACEHOLDER[d]}
                placeholderTextColor={c.textMuted}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                accessibilityLabel={`${RACE_LABEL[d]} personal best`}
                style={inputStyle}
              />
            </Row>
            {invalid ? <Small style={{ color: c.danger }}>Use minutes:seconds, or hours:minutes:seconds for longer races.</Small> : null}
            {pb ? (
              <Row>
                {RECENCY.map((r) => (
                  <Chip key={r.id} label={r.label} selected={pb.recency === r.id} onPress={() => setRecency(d, r.id)} />
                ))}
              </Row>
            ) : null}
          </Card>
        );
      })}

      {paces ? (
        <Card style={{ borderLeftColor: c.primary, borderLeftWidth: 4 }}>
          <H3>Your training paces</H3>
          <Small muted={false}>
            Easy runs: {paceLabel(paces.easy[0], units)}–{paceLabel(paces.easy[1], units)} /{units}
          </Small>
          {level !== 'new' ? (
            <Small muted={false}>
              Tempo: ~{paceLabel(paces.tempo, units)} /{units} · Intervals: ~{paceLabel(paces.interval, units)} /{units}
            </Small>
          ) : null}
          {goalDistance ? (
            <Small>
              Current {RACE_LABEL[goalDistance]} estimate: {formatTime(predictTime(paces.fiveKSec, goalDistance))}
            </Small>
          ) : null}
          <Small>Older times are adjusted a little slower. Easy runs stay easy whatever your PB.</Small>
        </Card>
      ) : null}

      {isFasterGoal(goal) && goalDistance ? (
        <Card>
          <H3>{RACE_LABEL[goalDistance]} goal time</H3>
          <Small>{suggestion ? `Suggested: ${formatTime(suggestion)}, about 3% quicker than your current estimate. Optional.` : 'Optional.'}</Small>
          <TextInput
            value={goalText}
            onChangeText={(v) => {
              setGoalText(v);
              onGoalTime(parseTime(v) ?? undefined);
            }}
            placeholder={suggestion ? formatTime(suggestion) : 'mm:ss'}
            placeholderTextColor={c.textMuted}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Goal time"
            style={inputStyle}
          />
        </Card>
      ) : null}
    </View>
  );
}
