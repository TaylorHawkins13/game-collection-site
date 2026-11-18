/** Fallback for platforms without a health store (web, simulators without HealthKit). */
import type { HealthService } from './types';

export const health: HealthService = {
  name: null,
  isAvailable: async () => false,
  connect: async () => false,
  readRecovery: async () => null,
  heartRateDuring: async () => null,
  writeWorkout: async () => false,
};
