/**
 * Confirmation dialogs. Native: a normal Alert. Web previews can't show native
 * alerts (and hosted previews block window.confirm), so there we run the
 * button marked `web: true` — or the last non-cancel button — directly.
 */
import { Alert, Platform } from 'react-native';

export interface DialogButton {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
  web?: boolean;
}

export function confirmDialog(title: string, message: string, buttons: DialogButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons.map(({ text, style, onPress }) => ({ text, style, onPress })));
    return;
  }
  const pick = buttons.find((b) => b.web) ?? [...buttons].reverse().find((b) => b.style !== 'cancel');
  pick?.onPress?.();
}
