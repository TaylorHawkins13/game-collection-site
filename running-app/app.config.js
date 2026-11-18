// Dynamic config on top of app.json.
//
//   GOOGLE_MAPS_ANDROID_API_KEY=...  Android route maps (iOS uses Apple Maps, no key).
//   STEADY_NO_HEALTH=1               Build without Apple Health: drops the HealthKit
//                                    entitlement so the app can be signed with a free
//                                    Apple ID. Health options are hidden in the app.
//   STEADY_WEB_PREVIEW=1             Web export as one bundle (no lazy route chunks),
//                                    for hosting the browser preview as a single page.
const noHealth = process.env.STEADY_NO_HEALTH === '1';
const webPreview = process.env.STEADY_WEB_PREVIEW === '1';

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins
      .filter((p) => !(noHealth && (p === 'react-native-health' || (Array.isArray(p) && p[0] === 'react-native-health'))))
      .map((p) => (webPreview && p === 'expo-router' ? ['expo-router', { asyncRoutes: { web: false } }] : p)),
    ['react-native-maps', process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } : {}],
  ],
  extra: { ...config.extra, healthEnabled: !noHealth },
});
