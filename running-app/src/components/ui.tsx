import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, space, useColors } from '../theme';

export function Screen({ children, scroll = true, edges }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[] }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges ?? ['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2, gap: space.lg }}>{children}</ScrollView>
      ) : (
        <View style={{ flex: 1, padding: space.lg, gap: space.lg }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const body = (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }, style]}>
      {children}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[font.title, { color: c.text }]} accessibilityRole="header">{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[font.h2, { color: c.text }]} accessibilityRole="header">{children}</Text>;
}

export function H3({ children, style }: { children: ReactNode; style?: object }) {
  const c = useColors();
  return <Text style={[font.h3, { color: c.text }, style]}>{children}</Text>;
}

export function Body({ children, muted, style, center }: { children: ReactNode; muted?: boolean; style?: object; center?: boolean }) {
  const c = useColors();
  return <Text style={[font.body, { color: muted ? c.textMuted : c.text, lineHeight: 21, textAlign: center ? 'center' : undefined }, style]}>{children}</Text>;
}

export function Small({ children, muted = true, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const c = useColors();
  return <Text style={[font.small, { color: muted ? c.textMuted : c.text }, style]}>{children}</Text>;
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  big,
  onLongPress,
  style,
}: {
  title: string;
  onPress?: () => void;
  onLongPress?: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  big?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.primary : kind === 'secondary' ? c.primarySoft : kind === 'danger' ? c.danger : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? c.primaryText : c.primary;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: big ? 18 : 12,
          paddingHorizontal: space.xl,
          alignItems: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: big ? 18 : 15, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Option({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : c.surface,
        padding: space.lg,
        gap: 2,
      }}
    >
      <Text style={[font.h3, { color: c.text }]}>{label}</Text>
      {description ? <Text style={[font.small, { color: c.textMuted }]}>{description}</Text> : null}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={{
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : c.surface,
        paddingVertical: 8,
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ color: selected ? c.primary : c.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function ProgressBar({ value, color, height = 10 }: { value: number; color?: string; height?: number }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={{ height, borderRadius: height, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color ?? c.primary, borderRadius: height }} />
    </View>
  );
}

export function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: 90, gap: 2 }}>
      <Text style={[big ? font.big : font.h2, { color: c.text, fontVariant: ['tabular-nums'] }]}>{value}</Text>
      <Text style={[font.small, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.6, color: c.textMuted, textTransform: 'uppercase' }}>{children}</Text>;
}
