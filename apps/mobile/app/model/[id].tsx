import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Copy, ExternalLink, MessageSquare, Share2 } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text } from "react-native";
import { EmptyState, Pill, Row, Screen, Section, usePalette } from "@/components/ui";
import { getModel } from "@/lib/api";
import { colour, space } from "@/theme";

export default function ModelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const p = usePalette();
  const model = useQuery({ queryKey: ["model", id], queryFn: () => getModel(id) });
  if (model.isLoading) return <Screen><ActivityIndicator style={{ marginTop: 80 }} color={colour.blue} /></Screen>;
  if (!model.data || model.isError) return <Screen><EmptyState title="Model unavailable" body="This model could not be loaded from Phaseo." /></Screen>;
  const m = model.data;
  return <Screen><ScrollView contentContainerStyle={{ paddingBottom: 48 }}><Text style={[styles.title, { color: p.text }]}>{m.name ?? m.id}</Text><Text selectable style={[styles.id, { color: p.muted }]}>{m.id}</Text>{m.status ? <Pill tone="blue">{m.status}</Pill> : null}<Text style={[styles.description, { color: p.muted }]}>{m.description ?? "No description is available for this model."}</Text>
    <Section title="Details"><Row title="Creator" trailing={<Text style={{ color: p.muted }}>{m.organisation?.name ?? m.organisation_name ?? "Unknown"}</Text>} /><Row title="Release date" trailing={<Text style={{ color: p.muted }}>{m.release_date ?? "Unavailable"}</Text>} /><Row title="Context" trailing={<Text style={styles.mono}>{m.context_length ? m.context_length.toLocaleString() : "Unavailable"}</Text>} /><Row title="Providers" trailing={<Text style={styles.mono}>{m.providers?.length ?? 0}</Text>} /></Section>
    <Section title="Actions"><Row icon={MessageSquare} title="Try in Chat" /><Row icon={Copy} title="Copy model ID" onPress={() => void Clipboard.setStringAsync(m.id)} /><Row icon={Share2} title="Share" onPress={() => void Share.share({ message: `https://phaseo.app/models/${m.id}` })} /><Row icon={ExternalLink} title="Open documentation" /></Section>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ title: { marginTop: space.xl, marginHorizontal: space.lg, fontSize: 28, fontWeight: "800" }, id: { marginHorizontal: space.lg, marginTop: 6, fontFamily: "monospace", fontSize: 13 }, description: { margin: space.lg, fontSize: 15, lineHeight: 23 }, mono: { fontFamily: "monospace", color: colour.blue } });
