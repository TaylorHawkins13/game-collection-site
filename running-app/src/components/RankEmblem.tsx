import { Text, View } from 'react-native';
import { divisionLabel, rankOf, tierOf } from '../domain/ranks';
import { RANK_COLORS } from '../theme';

const NUMERALS = ['I', 'II', 'III'];

/** A simple shield-like emblem: rank colour, initial and tier numeral. */
export function RankEmblem({ division, size = 64 }: { division: number; size?: number }) {
  const rank = rankOf(division);
  const tier = tierOf(division);
  const color = RANK_COLORS[rank];
  return (
    <View
      accessible
      accessibilityLabel={divisionLabel(division)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '45deg' }],
        shadowColor: color,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <View style={{ transform: [{ rotate: '-45deg' }], alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.34 }}>{rank === 'Grandmaster' ? 'GM' : rank[0]}</Text>
        {tier ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: Math.max(10, size * 0.2), marginTop: -2 }}>{NUMERALS[tier - 1]}</Text> : null}
      </View>
    </View>
  );
}
