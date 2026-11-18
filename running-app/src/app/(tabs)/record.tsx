// The Record tab is a button (see _layout.tsx); this route only exists so the tab has a slot.
import { Redirect } from 'expo-router';

export default function Record() {
  return <Redirect href="/" />;
}
