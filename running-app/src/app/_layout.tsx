import '../services/locationTracking'; // defines the background GPS task at startup
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState as RNAppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { scheduleReminders } from '../services/notifications';
import { refreshRecovery, retryPendingSyncs } from '../services/sync';
import { today, useStore } from '../state/store';
import { useColors } from '../theme';

export default function RootLayout() {
  const c = useColors();
  const hydrated = useStore((s) => s.hydrated);
  const plan = useStore((s) => s.app.plan);
  const profile = useStore((s) => s.app.profile);

  // Re-run the daily tick whenever the app comes back to the foreground (new day, new week, new season).
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active' && useStore.getState().hydrated) {
        useStore.getState().tick();
        void refreshRecovery();
        void retryPendingSyncs();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshRecovery();
    void retryPendingSyncs();
  }, [hydrated]);

  // Keep reminders in step with the plan.
  useEffect(() => {
    if (hydrated && profile) void scheduleReminders(useStore.getState().app, today()).catch(() => undefined);
  }, [hydrated, plan, profile]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: c.bg }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="session/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="summary/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="history/[id]" options={{ title: 'Session' }} />
        <Stack.Screen name="race/[id]" options={{ title: 'Race', presentation: 'modal' }} />
        <Stack.Screen name="share/[id]" options={{ title: 'Share', presentation: 'modal' }} />
        <Stack.Screen name="friends" options={{ title: 'Friends' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
