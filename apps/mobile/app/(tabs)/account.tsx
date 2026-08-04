import { Bell, BookOpen, CreditCard, KeyRound, LockKeyhole, LogOut, Palette, Shield, UserRound, UsersRound, WalletCards } from "lucide-react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, ScrollView, Switch, TextInput } from "react-native";
import { Row, Screen, Section, usePalette } from "@/components/ui";
import { secureKey } from "@/lib/secureKey";
import { useAuth } from "@/providers/AppProviders";

export default function AccountScreen() {
  const { session, signOut } = useAuth(); const router = useRouter(); const p = usePalette(); const [key, setKey] = useState(""); const [releaseAlerts, setReleaseAlerts] = useState(false);
  return <Screen><ScrollView contentContainerStyle={{ paddingBottom: 56 }}><Section title="Account"><Row icon={UserRound} title={session?.user.email ?? "Sign in"} subtitle={session ? "Profile, email and sign-in methods" : "Connect Google, GitHub or email"} onPress={session ? undefined : () => router.push("/sign-in")} /><Row icon={UsersRound} title="Workspace" subtitle="Members, roles and invitations" /></Section>
    <Section title="Usage and billing"><Row icon={WalletCards} title="Balance and spend" /><Row icon={CreditCard} title="Limits and payment management" /></Section>
    <Section title="API and chat" footer="The local key is encrypted by the operating system and is never written to settings storage, logs or analytics."><Row icon={KeyRound} title="Secure local key" subtitle="Stored only on this device" trailing={<TextInput value={key} onChangeText={setKey} onEndEditing={() => { if (key) void secureKey.set(key).then(() => { setKey(""); Alert.alert("Saved", "Your Phaseo key is protected on this device."); }); }} secureTextEntry placeholder="Paste key" placeholderTextColor={p.muted} style={{ color: p.text, width: 110 }} />} /></Section>
    <Section title="Notifications"><Row icon={Bell} title="New models" subtitle="Permission is requested only after choosing alerts" trailing={<Switch value={releaseAlerts} onValueChange={setReleaseAlerts} />} /></Section>
    <Section title="Appearance"><Row icon={Palette} title="Theme and density" subtitle="System theme · standard density" /></Section>
    <Section title="Privacy and security"><Row icon={Shield} title="Biometrics, MFA and sessions" /><Row icon={LockKeyhole} title="I/O logging and analytics" /></Section>
    <Section title="Support"><Row icon={BookOpen} title="Documentation and status" /></Section>
    {session ? <Section title="Session"><Row icon={LogOut} title="Sign out" subtitle="Clears private caches and the local API key" onPress={() => void signOut()} /></Section> : null}</ScrollView></Screen>;
}
