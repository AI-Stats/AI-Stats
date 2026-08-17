import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type PropsWithChildren } from "react";

import { authClient } from "@/lib/authClient";
import { secureKey } from "@/lib/secureKey";

type OAuthProvider = "google" | "github";
type NativeSession = {
	user: { id: string; email: string; name: string; image?: string | null };
	session: Record<string, unknown>;
};
type AuthValue = {
	session: NativeSession | null;
	ready: boolean;
	signInWithEmail(email: string): Promise<void>;
	signInWithProvider(provider: OAuthProvider): Promise<void>;
	signOut(): Promise<void>;
};

const unavailable = async () => { throw new Error("Authentication is unavailable for this build."); };
const AuthContext = createContext<AuthValue>({
	session: null,
	ready: false,
	signInWithEmail: unavailable,
	signInWithProvider: unavailable,
	signOut: async () => undefined,
});

export const useAuth = () => useContext(AuthContext);

const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 60_000, retry: 1, networkMode: "offlineFirst" } },
});

export function AppProviders({ children }: PropsWithChildren) {
	const sessionQuery = authClient.useSession();
	const session = (sessionQuery.data ?? null) as NativeSession | null;
	const ready = !sessionQuery.isPending;

	const value = useMemo<AuthValue>(() => ({
		session,
		ready,
		signInWithEmail: async (email) => {
			const { error } = await authClient.signIn.magicLink({
				email,
				callbackURL: "/",
				errorCallbackURL: "/sign-in",
			});
			if (error) throw new Error(error.message ?? "Could not send the sign-in link.");
		},
		signInWithProvider: async (provider) => {
			const { error } = await authClient.signIn.social({ provider, callbackURL: "/" });
			if (error) throw new Error(error.message ?? "Could not complete social sign-in.");
		},
		signOut: async () => {
			const { error } = await authClient.signOut();
			if (error) throw new Error(error.message ?? "Could not sign out.");
			await Promise.all([
				secureKey.clear(),
				AsyncStorage.multiRemove(["phaseo.workspace", "phaseo.private-cache"]),
			]);
			queryClient.clear();
		},
	}), [ready, session]);

	return (
		<QueryClientProvider client={queryClient}>
			<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
		</QueryClientProvider>
	);
}
