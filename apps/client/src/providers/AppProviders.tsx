import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import { secureKey } from "@/lib/secureKey";

type AuthValue = { session: Session | null; ready: boolean; signOut(): Promise<void> };
const AuthContext = createContext<AuthValue>({ session: null, ready: false, signOut: async () => undefined });
export const useAuth = () => useContext(AuthContext);

const extras = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extras?.supabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extras?.supabaseAnonKey;
const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key)
};
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
}) : null;

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, networkMode: "offlineFirst" } } });

export function AppProviders({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const listener = supabase?.auth.onAuthStateChange((_event, next) => setSession(next));
    const appState = AppState.addEventListener("change", state => state === "active" ? supabase?.auth.startAutoRefresh() : supabase?.auth.stopAutoRefresh());
    return () => { listener?.data.subscription.unsubscribe(); appState.remove(); };
  }, []);
  const value = useMemo<AuthValue>(() => ({ session, ready, signOut: async () => {
    await supabase?.auth.signOut();
    await Promise.all([secureKey.clear(), AsyncStorage.multiRemove(["phaseo.workspace", "phaseo.private-cache"])]);
    queryClient.clear();
  } }), [session, ready]);
  return <QueryClientProvider client={queryClient}><AuthContext.Provider value={value}>{children}</AuthContext.Provider></QueryClientProvider>;
}
