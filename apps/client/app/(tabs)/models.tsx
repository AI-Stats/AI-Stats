import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Search, Star } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { EmptyState, Row, Screen, usePalette } from "@/components/ui";
import { getModels } from "@/lib/api";
import { colour, radius, space } from "@/theme";

export default function ModelsScreen() {
  const p = usePalette(); const [query, setQuery] = useState("");
  const models = useQuery({ queryKey: ["models", query], queryFn: () => getModels(query), placeholderData: previous => previous });
  return <Screen><View style={[styles.search, { borderColor: p.border, backgroundColor: p.surface }]}><Search size={18} color={p.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search models, creators or IDs" placeholderTextColor={p.muted} style={[styles.input, { color: p.text }]} autoCapitalize="none" autoCorrect={false} /></View>
    {models.isLoading ? <ActivityIndicator style={styles.loader} color={colour.blue} /> : models.isError ? <EmptyState title="Catalogue unavailable" body="Phaseo could not load the catalogue. Pull to try again." /> : <FlatList data={models.data} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={models.isRefetching} onRefresh={() => void models.refetch()} />} contentContainerStyle={models.data?.length ? styles.list : styles.fill} ListEmptyComponent={<EmptyState title="No models found" body="Try a broader model name, creator or model ID." />} renderItem={({ item }) => <Row icon={Star} title={item.name ?? item.id.split("/").at(-1) ?? item.id} subtitle={`${item.organisation?.name ?? item.organisation_name ?? item.id.split("/")[0]} · ${item.id}`} onPress={() => router.push({ pathname: "/model/[id]", params: { id: item.id } })} />} />}
  </Screen>;
}
const styles = StyleSheet.create({ search: { margin: space.lg, height: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm }, input: { flex: 1, fontSize: 15 }, loader: { marginTop: 48 }, list: { paddingBottom: 40 }, fill: { flexGrow: 1, justifyContent: "center" } });
