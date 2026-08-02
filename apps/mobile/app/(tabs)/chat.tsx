import { Send, Settings2, Square } from "lucide-react-native";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState, Screen, usePalette } from "@/components/ui";
import { streamChat } from "@/lib/api";
import { secureKey } from "@/lib/secureKey";
import { colour, radius, space } from "@/theme";

type Message = { id: string; role: "user" | "assistant"; content: string };
export default function ChatScreen() {
  const p = usePalette(); const [messages, setMessages] = useState<Message[]>([]); const [draft, setDraft] = useState(""); const [busy, setBusy] = useState(false); const abort = useRef<AbortController | null>(null);
  async function send() {
    const text = draft.trim(); if (!text || busy) return; const apiKey = await secureKey.get();
    if (!apiKey) { setMessages(v => [...v, { id: Crypto.randomUUID(), role: "assistant", content: "Add a Phaseo API key in Account → API and chat before sending." }]); return; }
    const user: Message = { id: Crypto.randomUUID(), role: "user", content: text }; setDraft(""); setMessages(v => [...v, user]); setBusy(true); abort.current = new AbortController();
    const assistantId = Crypto.randomUUID(); setMessages(v => [...v, { id: assistantId, role: "assistant", content: "" }]);
    try { await streamChat({ apiKey, model: "openai/gpt-5.6-sol", messages: [...messages, user].map(({ role, content }) => ({ role, content })), signal: abort.current.signal, onDelta: delta => setMessages(current => current.map(message => message.id === assistantId ? { ...message, content: message.content + delta } : message)) }); }
    catch (error) { setMessages(v => [...v, { id: Crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "The request failed." }]); } finally { setBusy(false); }
  }
  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}><View style={styles.controls}><Text style={[styles.model, { color: p.text }]}>openai/gpt-5.6-sol</Text><Settings2 color={p.muted} size={20} /></View><FlatList data={messages} keyExtractor={m => m.id} contentContainerStyle={messages.length ? styles.messages : styles.empty} ListEmptyComponent={<EmptyState title="Start a conversation" body="Use managed chat after signing in, or add a secure local Phaseo API key." />} renderItem={({ item }) => <View style={[styles.message, { alignSelf: item.role === "user" ? "flex-end" : "flex-start", backgroundColor: item.role === "user" ? colour.blue : p.surface }]}><Text selectable style={{ color: item.role === "user" ? colour.white : p.text, lineHeight: 21 }}>{item.content}</Text></View>} /><View style={[styles.composer, { borderColor: p.border }]}><TextInput value={draft} onChangeText={setDraft} placeholder="Message Phaseo…" placeholderTextColor={p.muted} multiline style={[styles.input, { color: p.text }]} /><Pressable accessibilityLabel={busy ? "Stop response" : "Send message"} onPress={busy ? () => abort.current?.abort() : () => void send()} style={styles.send}>{busy ? <Square color={colour.white} size={18} /> : <Send color={colour.white} size={18} />}</Pressable></View></KeyboardAvoidingView></Screen>;
}
const styles = StyleSheet.create({ controls: { height: 48, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, model: { fontFamily: "monospace", fontWeight: "600" }, messages: { padding: space.lg, gap: space.md }, empty: { flexGrow: 1, justifyContent: "center" }, message: { maxWidth: "88%", borderRadius: radius.lg, padding: space.md }, composer: { margin: space.md, borderWidth: 1, borderRadius: radius.lg, flexDirection: "row", alignItems: "flex-end", padding: space.sm }, input: { flex: 1, minHeight: 38, maxHeight: 140, padding: space.sm }, send: { width: 40, height: 40, backgroundColor: colour.blue, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" } });
