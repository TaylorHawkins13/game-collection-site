import { useColorScheme } from 'react-native';

const light = {
  bg: '#EDEEEC',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F2',
  text: '#1D2420',
  textMuted: '#5E6B63',
  border: '#E2E4E1',
  primary: '#FC4C02',
  primaryText: '#FFFFFF',
  primarySoft: '#FFF0EB',
  accent: '#E8A33D',
  danger: '#C4553F',
  rest: '#8DA3B8',
  missed: '#E4E1D9',
  mapLine: '#FC4C02',
};

const dark: typeof light = {
  bg: '#000000',
  surface: '#141816',
  surfaceAlt: '#1E2420',
  text: '#EDF2EE',
  textMuted: '#9DAAA2',
  border: '#2C3530',
  primary: '#FF6B35',
  primaryText: '#0D1A14',
  primarySoft: '#3A1F14',
  accent: '#F0B65C',
  danger: '#E07A63',
  rest: '#6E869C',
  missed: '#2A302C',
  mapLine: '#FF6B35',
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
