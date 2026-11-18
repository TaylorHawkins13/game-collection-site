/** Post-session health sync: pull HR for the session window, then write the workout. */
import { trimRouteEnds } from '../domain/gps';
import { useStore, today } from '../state/store';
import { health } from './health';

export async function syncActivityToHealth(activityId: string): Promise<void> {
  const { app } = useStore.getState();
  if (!app.health.connected) return;
  const a = app.activities.find((x) => x.id === activityId);
  if (!a || a.healthSynced) return;
  try {
    const hr = await health.heartRateDuring(a.startedAt, a.endedAt);
    if (hr) useStore.getState().patchActivity(a.id, { avgHr: hr.avg, maxHr: hr.max });
    const route = a.route && app.profile?.hideRouteEnds ? trimRouteEnds(a.route) : a.route;
    const ok = await health.writeWorkout({ ...a, route });
    if (ok) useStore.getState().markHealthSynced(a.id);
  } catch {
    // Offline or permission revoked: the activity stays local and can retry next launch.
  }
}

export async function refreshRecovery(): Promise<void> {
  const { app } = useStore.getState();
  if (!app.health.connected) return;
  const r = await health.readRecovery(today()).catch(() => null);
  if (r) useStore.getState().setRecovery(r);
}

/** Retry any sessions that didn't sync (e.g. recorded offline). */
export async function retryPendingSyncs(): Promise<void> {
  const { app } = useStore.getState();
  if (!app.health.connected) return;
  for (const a of app.activities.slice(0, 20)) if (!a.healthSynced) await syncActivityToHealth(a.id);
}
