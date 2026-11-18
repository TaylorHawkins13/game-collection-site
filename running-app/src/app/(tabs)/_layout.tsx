import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { useRunStore } from '../../state/runStore';
import { useStore } from '../../state/store';
import { useColors } from '../../theme';

export default function TabsLayout() {
  const c = useColors();
  const profile = useStore((s) => s.app.profile);
  const active = useRunStore((s) => s.active);
  if (!profile) return <Redirect href="/onboarding" />;
  // A run was in progress when the app was closed: go straight back to it.
  if (active) return <Redirect href={`/session/${active.plannedSessionId ?? 'free'}`} />;
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('trophy-outline') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('list-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Plan', tabBarIcon: icon('options-outline') }} />
    </Tabs>
  );
}
