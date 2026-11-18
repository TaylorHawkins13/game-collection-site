/** Fallback (web): no lock-screen stats. Native versions: liveActivity.ios.ts / liveActivity.android.ts. */
import type { LiveStatus } from '../domain/liveStatus';

export const liveStats = {
  supported: false,
  start: (_s: LiveStatus) => {},
  update: (_s: LiveStatus) => {},
  end: (_s?: LiveStatus) => {},
};
