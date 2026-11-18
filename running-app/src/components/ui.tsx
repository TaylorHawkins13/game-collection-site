/**
 * Layout primitives. Visual language: flat, full-width white sections on a
 * grey gutter (no floating boxes), list rows with dividers, medium-radius
 * buttons, small labels above big numbers.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, space, useColors } from '../theme';

const GUTTER = space.lg;

export function Screen({ children, scroll = true, edges }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[] }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges ?? ['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.xxl * 2, gap: space.sm }}>{children}</ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: GUTTER, paddingTop: space.md, gap: space.sm }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/** A flat, edge-to-edge white section. (Named Card for history; it no longer looks like one.) */
export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const body = (
    <View style={[{ backgroundColor: c.surface, marginHorizontal: -GUTTER, paddingHorizontal: GUTTER, paddingVertical: space.lg, gap: space.sm }, style]}>{children}</View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} accessibilityRole="button">
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
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : 'transparent';
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
          borderRadius: radius.md,
          borderWidth: kind === 'secondary' ? 1.5 : 0,
          borderColor: c.primary,
          minHeight: 52,
          paddingVertical: big ? 16 : 12,
          paddingHorizontal: space.xl,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: big ? 17 : 15, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

/** Big circular control (record / pause / resume / finish). */
export function RoundButton({
  label,
  onPress,
  kind = 'primary',
  size = 84,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'neutral' | 'danger';
  size?: number;
  icon?: ReactNode;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : c.surface;
  const fg = kind === 'neutral' ? c.text : c.primaryText;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: kind === 'neutral' ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: c.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        })}
      >
        {icon ?? <Text style={{ color: fg, fontWeight: '800', fontSize: 15 }}>{label}</Text>}
      </Pressable>
      {icon ? <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
    </View>
  );
}

/** Groups Option rows into one contiguous list. */
export function OptionGroup({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={{ marginHorizontal: -GUTTER, backgroundColor: c.surface }}>{children}</View>;
}

/** A list row with a round radio indicator on the right. Minimum 52px touch height. */
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
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 52,
        paddingVertical: space.lg,
        paddingHorizontal: GUTTER,
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[font.h3, { color: c.text }]}>{label}</Text>
        {description ? <Text style={[font.small, { color: c.textMuted }]}>{description}</Text> : null}
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: selected ? c.primary : c.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.primary }} /> : null}
      </View>
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
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: selected ? c.text : c.border,
        backgroundColor: selected ? c.text : c.surface,
        minHeight: 40,
        paddingVertical: 10,
        paddingHorizontal: 16,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: selected ? c.surface : c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
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

/** Small grey label above a big number. */
export function Stat({ label, value, big, center }: { label: string; value: string; big?: boolean; center?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: 80, gap: 2, alignItems: center ? 'center' : 'flex-start' }}>
      <Text style={{ fontSize: 12, color: c.textMuted, fontWeight: '500' }}>{label}</Text>
      <Text style={[big ? font.big : { fontSize: 20, fontWeight: '700' as const }, { color: c.text, fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}

/** A row of Stats separated by thin vertical dividers. */
export function StatRow({ children }: { children: ReactNode }) {
  const c = useColors();
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      {items.map((child, i) => (
        <View key={i} style={{ flex: 1, flexDirection: 'row' }}>
          {i > 0 ? <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: c.border, marginRight: space.md }} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontSize: 13, fontWeight: '700', color: c.textMuted, marginTop: space.md, marginBottom: 2 }}>{children}</Text>;
}
