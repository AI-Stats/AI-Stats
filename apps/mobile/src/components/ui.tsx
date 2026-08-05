import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colour, icon, radius, space } from "@/theme";

export function usePalette() {
  const dark = useColorScheme() === "dark";
  return { dark, bg: dark ? colour.black : colour.white, surface: dark ? colour.grey800 : colour.grey50, text: dark ? colour.grey50 : colour.black, muted: dark ? colour.grey400 : colour.grey600, border: dark ? colour.grey800 : colour.grey200 };
}

export function Screen({ children, safeTop = true }: PropsWithChildren<{ safeTop?: boolean }>) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return <View style={[styles.screen, { backgroundColor: p.bg, paddingTop: safeTop ? insets.top : 0 }]}>{children}</View>;
}
export function Section({ title, children, footer }: PropsWithChildren<{ title: string; footer?: string }>) {
  const p = usePalette();
  return <View style={styles.section}><Text style={[styles.heading, { color: p.text }]}>{title}</Text><View style={[styles.card, { borderColor: p.border }]}>{children}</View>{footer ? <Text style={[styles.footer, { color: p.muted }]}>{footer}</Text> : null}</View>;
}
export function Row({ icon: Icon, title, subtitle, trailing, onPress }: { icon?: LucideIcon; title: string; subtitle?: string; trailing?: ReactNode; onPress?: () => void }) {
  const p = usePalette();
  return <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={() => { if (onPress) void Haptics.selectionAsync(); onPress?.(); }} style={({ pressed }) => [styles.row, pressed && { opacity: 0.62 }]}>
    {Icon ? <Icon color={colour.blue} size={icon.row} strokeWidth={icon.stroke} /> : null}<View style={styles.grow}><Text style={[styles.rowTitle, { color: p.text }]}>{title}</Text>{subtitle ? <Text style={[styles.subtitle, { color: p.muted }]}>{subtitle}</Text> : null}</View>{trailing}
  </Pressable>;
}
export function EmptyState({ title, body }: { title: string; body: string }) { const p = usePalette(); return <View style={styles.empty}><Text style={[styles.heading, { color: p.text }]}>{title}</Text><Text style={[styles.subtitle, { color: p.muted }]}>{body}</Text></View>; }
export function Pill({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "blue" | "green" | "red" }>) { const p = usePalette(); const c = tone === "blue" ? colour.blue : tone === "green" ? colour.green : tone === "red" ? colour.red : p.muted; return <View style={[styles.pill, { borderColor: c }]}><Text style={{ color: c, fontSize: 12, fontWeight: "600" }}>{children}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, section: { marginHorizontal: space.lg, marginTop: space.xl, gap: space.sm }, heading: { fontSize: 18, fontWeight: "700" }, card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: "hidden" }, footer: { fontSize: 12, lineHeight: 17, marginHorizontal: space.sm }, row: { minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: "row", alignItems: "center", gap: space.md }, grow: { flex: 1, gap: 2 }, rowTitle: { fontSize: 15, fontWeight: "600" }, subtitle: { fontSize: 13, lineHeight: 18 }, empty: { padding: space.xxl, alignItems: "center", gap: space.sm }, pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }
});
