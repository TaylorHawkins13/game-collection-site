/** Fallback for platforms without a health store (web). iOS/Android use index.ios.ts / index.android.ts. */
export { unavailableHealth as health } from './unavailable';
