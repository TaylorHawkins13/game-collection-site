// Adds the Google Maps key for Android route maps from the environment, so it
// never has to be committed. iOS uses Apple Maps and needs no key.
//   GOOGLE_MAPS_ANDROID_API_KEY=... npx expo prebuild
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins,
    ['react-native-maps', process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } : {}],
  ],
});
