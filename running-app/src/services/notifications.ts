/**
 * Plan-aware reminders. Instead of one static daily repeat, we schedule
 * individual notifications for the next 7 days so the text matches the actual
 * session ("20 min walk-run") and rest days stay quiet. Re-run whenever the
 * plan or settings change, and on every app open.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, fromDateKey } from '../domain/dates';
import { allSessions } from '../domain/plan';
import type { AppState, DateKey } from '../domain/types';

const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Session reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const MORNING = [
  (t: string) => `Today: ${t}. Showing up is the win.`,
  (t: string) => `${t} on the plan today. Easy does it.`,
  (t: string) => `Your session today: ${t}. Whenever suits you.`,
];

export async function scheduleReminders(state: AppState, today: DateKey): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const p = state.profile;
  if (!p || !state.plan) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const sessions = allSessions(state.plan);
  const now = Date.now();
  for (let i = 0; i < 7; i++) {
    const day = addDays(today, i);
    const todays = sessions.filter((s) => s.date === day && s.status === 'planned' && !s.optional);
    if (!todays.length) continue;
    const title = todays[0].title;
    const base = fromDateKey(day);
    if (p.morningReminder.enabled) {
      const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), p.morningReminder.hour, p.morningReminder.minute);
      if (at.getTime() > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `morning-${day}`,
          content: { title: 'Steady', body: MORNING[i % MORNING.length](title) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
      }
    }
    if (p.afternoonNudge.enabled) {
      const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), p.afternoonNudge.hour, p.afternoonNudge.minute);
      if (at.getTime() > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `nudge-${day}`,
          content: { title: 'Still time today', body: 'Even a shorter version counts. No pressure.' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
      }
    }
  }
}

/** Called after a session is completed so the afternoon nudge doesn't nag. */
export async function cancelTodayNudge(today: DateKey) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(`nudge-${today}`).catch(() => undefined);
}
