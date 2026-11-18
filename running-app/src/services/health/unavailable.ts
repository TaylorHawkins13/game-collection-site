/** No health store: web, devices without HealthKit/Health Connect, or builds made with STEADY_NO_HEALTH=1. */
import type { HealthService } from './types';

export const unavailableHealth: HealthService = {
  name: null,
  isAvailable: async () => false,
  connect: async () => false,
  readRecovery: async () => null,
  heartRateDuring: async () => null,
  writeWorkout: async () => false,
  latestHeartRate: async () => null,
  importRuns: async () => [],
};
