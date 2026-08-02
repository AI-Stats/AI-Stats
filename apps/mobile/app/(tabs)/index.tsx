import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, Bot, ChartNoAxesCombined, MessageSquare, TriangleAlert } from "lucide-react-native";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState, Row, Screen, Section, usePalette } from "@/components/ui";
import { getReleases } from "@/lib/api";
import { useAuth } from "@/providers/AppProviders";
import { colour, radius, space } from "@/theme";

export default function HomeScreen() {
  const p = usePalette(); const { session } = useAuth(); const releases = useQuery({ queryKey: ["releases"], queryFn: getReleases });
  return <Screen><ScrollView refreshControl={<RefreshControl refreshing={releases.isRefetching} onRefresh={() => void releases.refetch()} />} contentContainerStyle={{ paddingBottom: 48 }}><View style={styles.header}><View><Text style={[styles.brand, { color: p.text }]}>Phaseo</Text><Text style={{ color: p.muted }}>{session ? "Workspace overview" : "Discover, route and observe AI"}</Text></View><Bell color={p.text} /></View>
    {!session ? <View style={[styles.callout, { borderColor: colour.blue }]}><Text style={[styles.calloutTitle, { color: p.text }]}>Your catalogue is ready</Text><Text style={{ color: p.muted }}>Sign in from Account to add usage, activity and managed chat.</Text></View> : <Section title="Usage"><EmptyState title="Select a workspace" body="Workspace metrics load only after an active workspace has been confirmed." /></Section>}
    <Section title="Quick actions"><Row icon={MessageSquare} title="Start a chat" onPress={() => router.navigate("/chat")} /><Row icon={Bot} title="Browse models" onPress={() => router.navigate("/models")} /><Row icon={ChartNoAxesCombined} title="Inspect usage" /><Row icon={TriangleAlert} title="Review errors" onPress={() => router.navigate("/activity")} /></Section>
    <Section title="Model releases">{releases.isError ? <EmptyState title="Releases unavailable" body="No cached release data is available yet." /> : releases.isLoading ? <Text style={[styles.loading, { color: p.muted }]}>Loading releases…</Text> : <Row icon={Bot} title="Latest releases" subtitle="Live release data loaded from Phaseo" onPress={() => router.navigate("/models")} />}</Section>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ header: { padding: space.lg, paddingTop: space.xl, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, brand: { fontSize: 30, fontWeight: "900" }, callout: { borderWidth: 1, borderRadius: radius.lg, margin: space.lg, padding: space.lg, gap: space.sm }, calloutTitle: { fontSize: 18, fontWeight: "700" }, loading: { padding: space.lg } });
