import * as Speech from 'expo-speech';

let enabled = true;

export function setAudioEnabled(on: boolean) {
  enabled = on;
  if (!on) void Speech.stop();
}

/** Speak a cue. Kept short; queued cues never pile up — a new cue replaces a stale one. */
export function speak(text: string) {
  if (!enabled) return;
  Speech.speak(text, { rate: 0.98, pitch: 1.0 });
}

export function stopSpeaking() {
  void Speech.stop();
}
