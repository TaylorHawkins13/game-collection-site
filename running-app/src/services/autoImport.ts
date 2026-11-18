/**
 * Finds runs recorded on a watch (Garmin, Apple Watch, …) and counts them.
 * Runs on app open/foreground, and periodically in the background via
 * expo-background-task (the OS decides when; on iOS often overnight or when
 * charging). Sources: Apple Health / Health Connect (if connected) and Strava.
 */
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { ImportedRun } from '../domain/types';
import { useStore } from '../state/store';
import { health } from './health';
import { importFromStrava, stravaConfigured } from './strava';

export const AUTO_IMPORT_TASK = 'steady-auto-import';
let running = false;

/** Returns ids of activities that were counted automatically. */
export async function runAutoImport(opts: { background?: boolean } = {}): Promise<string[]> {
  if (running) return [];
  const { app } = useStore.getState();
  if (!app.profile || !app.plan) return [];
  const healthOn = app.health.connected && !!health.name;
  const stravaOn = !!app.profile.strava && stravaConfigured();
  if (!healthOn && !stravaOn) return [];
  running = true;
  try {
    // Look back a little before the last check (watch apps can sync late), at most 7 days.
    const since = Math.max(Date.now() - 7 * 86_400_000, (app.lastAutoImport ?? 0) - 6 * 3_600_000);
    const batches = await Promise.all([
      healthOn ? health.importRuns(since).catch(() => [] as ImportedRun[]) : Promise.resolve([] as ImportedRun[]),
      stravaOn ? importFromStrava(since).catch(() => [] as ImportedRun[]) : Promise.resolve([] as ImportedRun[]),
    ]);
    const before = new Set(useStore.getState().app.activities.map((a) => a.id));
    useStore.getState().importHistory(batches.flat());
    useStore.setState((st) => ({ app: { ...st.app, lastAutoImport: Date.now() } }));
    const counted = useStore.getState().app.activities.filter((a) => !before.has(a.id) && a.importedFrom).map((a) => a.id);
    if (opts.background) {
      for (const id of counted) {
        const a = useStore.getState().app.activities.find((x) => x.id === id);
        await Notifications.scheduleNotificationAsync({
          content: { title: `${a?.kind === 'strength' ? 'Workout' : 'Run'} counted ✓ +${a?.xpEarned ?? 0} XP`, body: `${a?.title ?? 'Your watch session'} is in. Tap to check in.`, data: { url: `/summary/${id}` } },
          trigger: null,
        }).catch(() => undefined);
      }
    }
    return counted;
  } finally {
    running = false;
  }
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(AUTO_IMPORT_TASK)) {
  TaskManager.defineTask(AUTO_IMPORT_TASK, async () => {
    try {
      // Make sure persisted state is loaded when the OS launches us headless.
      if (!useStore.getState().hydrated) await useStore.persist.rehydrate();
      await runAutoImport({ background: true });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerAutoImport(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(AUTO_IMPORT_TASK))) {
      await BackgroundTask.registerTaskAsync(AUTO_IMPORT_TASK, { minimumInterval: 60 });
    }
  } catch {
    // Background work disabled (Low Power Mode, Background App Refresh off): foreground checks still run.
  }
}
