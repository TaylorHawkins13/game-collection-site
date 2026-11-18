import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2EC',
  text: '#1D2420',
  textMuted: '#5E6B63',
  border: '#DDE3DC',
  primary: '#2F7D62',
  primaryText: '#FFFFFF',
  primarySoft: '#DCEFE6',
  accent: '#E8A33D',
  danger: '#C4553F',
  rest: '#8DA3B8',
  missed: '#E4E1D9',
  mapLine: '#2F7D62',
};

const dark: typeof light = {
  bg: '#111513',
  surface: '#1A201C',
  surfaceAlt: '#232B26',
  text: '#EDF2EE',
  textMuted: '#9DAAA2',
  border: '#2C3530',
  primary: '#5CC09A',
  primaryText: '#0D1A14',
  primarySoft: '#1E3A2E',
  accent: '#F0B65C',
  danger: '#E07A63',
  rest: '#6E869C',
  missed: '#2A302C',
  mapLine: '#5CC09A',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const RANK_COLORS: Record<string, string> = {
  Bronze: '#B0793F',
  Silver: '#8E9AA6',
  Gold: '#D4A73A',
  Platinum: '#3FA79C',
  Diamond: '#5B8DEF',
  Master: '#9B6BD6',
  Grandmaster: '#E0565B',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };
export const font = {
  title: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  huge: { fontSize: 56, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
  big: { fontSize: 32, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
};
