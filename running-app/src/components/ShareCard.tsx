/** The image that gets shared. Rendered off a fixed-size view and captured at 3× for a crisp 1080px-wide PNG. */
import type { RefObject } from 'react';
import { Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { formatShort, weekdayLong } from '../domain/dates';
import { averagePace, formatDistance, formatDuration, formatPace } from '../domain/gps';
import { divisionLabel } from '../domain/ranks';
import { routePolyline, shareHeadline, type ShareContext, type ShareOptions } from '../domain/share';
import type { Activity } from '../domain/types';
import { RankEmblem } from './RankEmblem';

export const CARD_W = 360;
export const CARD_H = 450;

const INK = '#0F1D17';
const PAPER = '#F4F6F2';
const GREEN = '#2F7D62';

function Big({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: '#5E6B63', fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 24, color: INK, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

export function ShareCard({ a, o, ctx, hideEnds, viewRef }: { a: Activity; o: ShareOptions; ctx: ShareContext; hideEnds: boolean; viewRef?: RefObject<any> }) {
  const line = o.showRoute ? routePolyline(a.route, CARD_W - 32, 190, 14, hideEnds) : null;
  const pace = a.distanceM ? averagePace(a.distanceM, a.durationSec, ctx.units) : null;
  return (
    <View ref={viewRef} collapsable={false} style={{ width: CARD_W, height: CARD_H, backgroundColor: PAPER, borderRadius: 24, padding: 16, gap: 12, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: GREEN, fontWeight: '800', letterSpacing: 0.6 }}>{shareHeadline(a).toUpperCase()}</Text>
          <Text style={{ fontSize: 13, color: '#5E6B63' }}>
            {weekdayLong(a.date)} {formatShort(a.date)}
          </Text>
        </View>
        {o.showRank ? <RankEmblem division={ctx.division} size={40} /> : null}
      </View>
      <Text style={{ fontSize: 22, color: INK, fontWeight: '800' }} numberOfLines={2}>
        {a.title}
      </Text>
      <View style={{ height: 190, borderRadius: 16, backgroundColor: '#E3E9E1', alignItems: 'center', justifyContent: 'center' }}>
        {line ? (
          <Svg width={CARD_W - 32} height={190}>
            <Polyline points={line} fill="none" stroke={GREEN} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        ) : (
          <Text style={{ fontSize: 56 }}>{a.kind === 'strength' ? '💪' : '👟'}</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Big label="Time" value={formatDuration(a.durationSec)} />
        {o.showDistance && a.distanceM ? <Big label="Distance" value={formatDistance(a.distanceM, ctx.units)} /> : null}
        {o.showPace && pace ? <Big label="Pace" value={formatPace(pace, ctx.units)} /> : null}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 12, color: INK, fontWeight: '600', flex: 1 }}>
          {o.showStreak ? [ctx.streak >= 2 ? `🔥 ${ctx.streak}-day streak` : null, ctx.weekTotal ? `${ctx.weekDone}/${ctx.weekTotal} this week` : null].filter(Boolean).join(' · ') : ''}
          {o.showRank ? `${o.showStreak ? '\n' : ''}${divisionLabel(ctx.division)}` : ''}
        </Text>
        <Text style={{ fontSize: 14, color: GREEN, fontWeight: '900' }}>steady</Text>
      </View>
    </View>
  );
}
