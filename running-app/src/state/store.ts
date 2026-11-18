/**
 * App store: wraps the pure engine with persistence (AsyncStorage, local-first
 * — no account needed) and exposes actions to screens.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toDateKey } from '../domain/dates';
import * as E from '../domain/engine';
import type { AppState, DateKey, EngineEvent, Feel, Pause, Profile, RaceDistance, RecoverySnapshot, Soreness } from '../domain/types';

export const today = (): DateKey => toDateKey(new Date());

interface Store {
  app: AppState;
  hydrated: boolean;
  /** Events produced by the most recent session/feedback, keyed by activity id (in-memory only). */
  sessionEvents: Record<string, EngineEvent[]>;
  /** Events from the latest tick (season reset, decay, new week), shown once on Home. */
  tickEvents: EngineEvent[];

  tick: () => void;
  onboard: (a: E.OnboardingAnswers, overrides?: Partial<Profile>) => void;
  completeSession: (input: E.SessionInput) => string;
  submitFeedback: (activityId: string, feel: Feel, soreness: Soreness) => string | null;
  claimRestDay: () => EngineEvent[];
  moveSession: (id: string, to: DateKey) => void;
  dropSession: (id: string) => void;
  skipSession: (id: string) => void;
  swapForMobility: (id: string) => void;
  pausePlan: (days: number, reason: Pause['reason']) => void;
  endPause: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setHealthConnected: (connected: boolean) => EngineEvent[];
  setRecovery: (r: RecoverySnapshot) => void;
  markHealthSynced: (activityId: string) => void;
  patchActivity: (activityId: string, patch: { avgHr?: number; maxHr?: number }) => void;
  dismissNotice: (id: string) => void;
  savePersonalBest: (pb: { distance: RaceDistance; timeSec: number }) => void;
  clearTickEvents: () => void;
  resetAll: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      app: E.createInitialState(today()),
      hydrated: false,
      sessionEvents: {},
      tickEvents: [],

      tick: () => {
        const r = E.tick(get().app, today());
        set((s) => ({ app: r.state, tickEvents: [...s.tickEvents, ...r.events.filter((e) => e.type !== 'xp')] }));
      },
      onboard: (a, overrides) => set({ app: E.onboard(get().app, a, today(), overrides) }),
      completeSession: (input) => {
        const r = E.completeSession(get().app, input, today());
        set((s) => ({ app: r.state, sessionEvents: { ...s.sessionEvents, [r.activity.id]: r.events } }));
        return r.activity.id;
      },
      submitFeedback: (activityId, feel, soreness) => {
        const r = E.submitFeedback(get().app, activityId, feel, soreness, today());
        set((s) => ({
          app: r.state,
          sessionEvents: { ...s.sessionEvents, [activityId]: [...(s.sessionEvents[activityId] ?? []), ...r.events] },
        }));
        return r.note;
      },
      claimRestDay: () => {
        const r = E.claimRestDay(get().app, today());
        set({ app: r.state });
        return r.events;
      },
      moveSession: (id, to) => set({ app: E.moveSession(get().app, id, to, today()) }),
      dropSession: (id) => set({ app: E.dropSession(get().app, id) }),
      skipSession: (id) => set({ app: E.skipSession(get().app, id) }),
      swapForMobility: (id) => set({ app: E.swapForMobility(get().app, id) }),
      pausePlan: (days, reason) => set({ app: E.pausePlan(get().app, today(), days, reason) }),
      endPause: () => set({ app: E.endPause(get().app, today()) }),
      updateProfile: (patch) => set({ app: E.updateProfile(get().app, patch, today()) }),
      setHealthConnected: (connected) => {
        const r = E.setHealthConnected(get().app, connected, today());
        set({ app: r.state });
        return r.events;
      },
      setRecovery: (r) => set({ app: E.setRecovery(get().app, r) }),
      markHealthSynced: (id) => set({ app: E.markHealthSynced(get().app, id) }),
      patchActivity: (id, patch) =>
        set((s) => ({ app: { ...s.app, activities: s.app.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) } })),
      dismissNotice: (id) => set({ app: E.dismissNotice(get().app, id) }),
      savePersonalBest: (pb) => set({ app: E.savePersonalBest(get().app, pb, today()).state }),
      clearTickEvents: () => set({ tickEvents: [] }),
      resetAll: () => set({ app: E.createInitialState(today()), sessionEvents: {}, tickEvents: [] }),
    }),
    {
      name: 'steady-app-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ app: s.app }),
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
        useStore.getState().tick();
      },
    },
  ),
);

export const useApp = () => useStore((s) => s.app);
