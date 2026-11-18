/**
 * The in-progress run. Persisted separately (and on every GPS batch) so a run
 * survives the app being backgrounded, the screen turning off, or the OS
 * killing the JS process — the next launch offers to resume it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addFix, createTracker, pauseTracker, resumeTracker, type RawFix, type TrackerState } from '../domain/gps';
import type { Units } from '../domain/types';

export interface ActiveRun {
  plannedSessionId?: string;
  title: string;
  tracker: TrackerState;
  firedCues: number[];
  easeOffSaid: boolean;
  /** Next split index to announce. */
  announcedSplits: number;
  /** Workout reps already announced. */
  announcedReps?: number;
  gpsMode: 'background' | 'foreground' | 'none';
  /** Latest heart rate and where it came from. */
  hr?: { bpm: number; t: number; source: 'strap' | 'health' } | null;
  /** Strap samples (thinned to one per ~5 s) for avg/max. */
  hrSamples?: { t: number; bpm: number }[];
  strapStatus?: 'connecting' | 'connected' | 'lost' | 'off';
}

interface RunStore {
  active: ActiveRun | null;
  start: (opts: { plannedSessionId?: string; title: string; units: Units; treadmill: boolean }) => void;
  ingest: (fixes: RawFix[]) => void;
  pause: () => void;
  resume: () => void;
  markCue: (i: number) => void;
  setEaseOffSaid: () => void;
  setAnnouncedSplits: (n: number) => void;
  setAnnouncedReps: (n: number) => void;
  setGpsMode: (m: ActiveRun['gpsMode']) => void;
  pushHr: (bpm: number, source: 'strap' | 'health') => void;
  setStrapStatus: (s: NonNullable<ActiveRun['strapStatus']>) => void;
  clear: () => void;
}

export const useRunStore = create<RunStore>()(
  persist(
    (set, get) => ({
      active: null,
      start: ({ plannedSessionId, title, units, treadmill }) =>
        set({
          active: {
            plannedSessionId,
            title,
            tracker: createTracker(Date.now(), units, treadmill),
            firedCues: [],
            easeOffSaid: false,
            announcedSplits: 0,
            gpsMode: treadmill ? 'none' : 'background',
          },
        }),
      ingest: (fixes) => {
        const a = get().active;
        if (!a) return;
        let t = a.tracker;
        for (const f of [...fixes].sort((x, y) => x.t - y.t)) t = addFix(t, f);
        if (t !== a.tracker) set({ active: { ...a, tracker: t } });
      },
      pause: () => {
        const a = get().active;
        if (a) set({ active: { ...a, tracker: pauseTracker(a.tracker, Date.now()) } });
      },
      resume: () => {
        const a = get().active;
        if (a) set({ active: { ...a, tracker: resumeTracker(a.tracker, Date.now()) } });
      },
      markCue: (i) => {
        const a = get().active;
        if (a && !a.firedCues.includes(i)) set({ active: { ...a, firedCues: [...a.firedCues, i] } });
      },
      setEaseOffSaid: () => {
        const a = get().active;
        if (a) set({ active: { ...a, easeOffSaid: true } });
      },
      setAnnouncedSplits: (n) => {
        const a = get().active;
        if (a) set({ active: { ...a, announcedSplits: n } });
      },
      setAnnouncedReps: (n) => {
        const a = get().active;
        if (a) set({ active: { ...a, announcedReps: n } });
      },
      setGpsMode: (m) => {
        const a = get().active;
        if (a) set({ active: { ...a, gpsMode: m } });
      },
      pushHr: (bpm, source) => {
        const a = get().active;
        if (!a || a.tracker.paused) return;
        const now = Date.now();
        const samples = a.hrSamples ?? [];
        const keep = source === 'strap' && (!samples.length || now - samples[samples.length - 1].t >= 5000);
        set({ active: { ...a, hr: { bpm, t: now, source }, hrSamples: keep ? [...samples, { t: now, bpm }].slice(-5000) : samples } });
      },
      setStrapStatus: (st) => {
        const a = get().active;
        if (a) set({ active: { ...a, strapStatus: st } });
      },
      clear: () => set({ active: null }),
    }),
    { name: 'steady-active-run-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
