import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { Pressable, View, type ColorValue } from 'react-native';
import { todaySessions } from '../../domain/engine';
import { useRunStore } from '../../state/runStore';
import { today, useStore } from '../../state/store';
import { useColors } from '../../theme';

/** Record: start today's planned session if there is one, otherwise a free easy run. */
export function startRecording() {
  const app = useStore.getState().app;
  const next = todaySessions(app, today()).find((s) => s.status === 'planned' && !s.optional) ?? todaySessions(app, today()).find((s) => s.status === 'planned');
  router.push(`/session/${next?.id ?? 'free'}`);
}

function RecordButton() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        onPress={startRecording}
        accessibilityRole="button"
        accessibilityLabel="Record a session"
        style={({ pressed }) => ({
          marginTop: -18,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: c.surface,
          opacity: pressed ? 0.85 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        })}
      >
        <Ionicons name="play" size={26} color={c.primaryText} style={{ marginLeft: 3 }} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const c = useColors();
  const profile = useStore((s) => s.app.profile);
  const active = useRunStore((s) => s.active);
  if (!profile) return <Redirect href="/onboarding" />;
  // A run was in progress when the app was closed: go straight back to it.
  if (active) return <Redirect href={`/session/${active.plannedSessionId ?? 'free'}`} />;
  const icon =
    (name: keyof typeof Ionicons.glyphMap) =>
    ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="record" options={{ title: 'Record', tabBarButton: () => <RecordButton /> }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
