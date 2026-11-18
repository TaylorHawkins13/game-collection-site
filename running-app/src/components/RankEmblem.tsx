import { Text, View } from 'react-native';
import { divisionLabel, rankOf, tierOf } from '../domain/ranks';
import { RANK_COLORS } from '../theme';

/** Round medal: rank colour with a white inner ring, the rank initial, and 1–3 tier pips. */
export function RankEmblem({ division, size = 64 }: { division: number; size?: number }) {
  const rank = rankOf(division);
  const tier = tierOf(division);
  const color = RANK_COLORS[rank];
  const pip = Math.max(4, size * 0.08);
  return (
    <View
      accessible
      accessibilityLabel={divisionLabel(division)}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: size * 0.82,
          height: size * 0.82,
          borderRadius: size,
          borderWidth: Math.max(1.5, size * 0.04),
          borderColor: 'rgba(255,255,255,0.7)',
          alignItems: 'center',
          justifyContent: 'center',
          gap: size * 0.03,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * (rank === 'Grandmaster' ? 0.28 : 0.36), lineHeight: size * 0.42 }}>
          {rank === 'Grandmaster' ? 'GM' : rank[0]}
        </Text>
        {tier ? (
          <View style={{ flexDirection: 'row', gap: pip * 0.6 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ width: pip, height: pip, borderRadius: pip, backgroundColor: i <= tier ? '#fff' : 'rgba(255,255,255,0.35)' }} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
