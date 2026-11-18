/** Android: a silent, ongoing notification with live stats (replaced in place every ~10 s). */
import * as Notifications from 'expo-notifications';
import type { LiveStatus } from '../domain/liveStatus';
import { formatDuration } from '../domain/gps';

const ID = 'steady-live-run';
let channelReady = false;
let active = false;
let lastSent = 0;

async function ensureChannel() {
  if (channelReady) return;
  await Notifications.setNotificationChannelAsync('live-run', {
    name: 'Run in progress',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
  });
  channelReady = true;
}

async function show(s: LiveStatus) {
  await ensureChannel();
  const body = s.phaseEndsAt ? `${s.subtitle} · ${formatDuration(Math.max(0, (s.phaseEndsAt - Date.now()) / 1000))} left` : s.subtitle;
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: s.title, body, sticky: true, autoDismiss: false, sound: false, priority: Notifications.AndroidNotificationPriority.LOW },
    trigger: { channelId: 'live-run' },
  });
}

export const liveStats = {
  supported: true,
  start(s: LiveStatus) {
    active = true;
    lastSent = Date.now();
    void show(s).catch(() => undefined);
  },
  update(s: LiveStatus) {
    if (!active || Date.now() - lastSent < 10_000) return;
    lastSent = Date.now();
    void show(s).catch(() => undefined);
  },
  end() {
    if (!active) return;
    active = false;
    void Notifications.dismissNotificationAsync(ID).catch(() => undefined);
  },
};
