/** Profile: your progress (rank, season, badges) and your plan & settings, one tap apart. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PlanView } from '../../components/PlanView';
import { ProgressView } from '../../components/ProgressView';
import { RankEmblem } from '../../components/RankEmblem';
import { H1, Row, Small } from '../../components/ui';
import { divisionLabel } from '../../domain/ranks';
import { useStore } from '../../state/store';
import { radius, space, useColors } from '../../theme';

type View_ = 'progress' | 'plan';

function Segmented({ value, onChange }: { value: View_; onChange: (v: View_) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4 }} accessibilityRole="tablist">
      {(['progress', 'plan'] as View_[]).map((v) => {
        const on = value === v;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: on ? c.surface : 'transparent' }}
          >
            <Text style={{ fontWeight: '700', color: on ? c.text : c.textMuted }}>{v === 'progress' ? 'Progress' : 'Plan & settings'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Profile() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<View_>(params.view === 'plan' ? 'plan' : 'progress');
  const division = useStore((s) => s.app.rank.division);
  const peak = useStore((s) => s.app.peakDivisionEver);

  useEffect(() => {
    if (params.view === 'plan' || params.view === 'progress') setView(params.view);
  }, [params.view]);

  const header = (
    <View style={{ gap: space.md }}>
      <Row style={{ flexWrap: 'nowrap' }}>
        {view === 'plan' ? <RankEmblem division={division} size={44} /> : null}
        <View style={{ flex: 1 }}>
          <H1>Profile</H1>
          <Small>
            {divisionLabel(division)} · peak {divisionLabel(peak)}
          </Small>
        </View>
      </Row>
      <Segmented
        value={view}
        onChange={(v) => {
          setView(v);
          router.setParams({ view: v });
        }}
      />
    </View>
  );

  return view === 'progress' ? <ProgressView header={header} /> : <PlanView header={header} />;
}
