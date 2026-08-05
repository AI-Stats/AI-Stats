import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { fetchClientAuthHeaderData } from "@/lib/fetchers/internal/fetchClientAuthHeaderData";

export type ChatUser = {
	id: string;
	email: string | null;
	name: string;
	avatarUrl: string | null;
};

const CHAT_PERF_TEST_USER: ChatUser = {
	id: "chat-performance-test-user",
	email: "chat-performance@example.test",
	name: "Chat Performance Test",
	avatarUrl: null,
};

function shouldBypassAuthForChatPerformance() {
	return (
		process.env.NODE_ENV !== "production" &&
		typeof window !== "undefined" &&
		new URLSearchParams(window.location.search).get("chatPerfAuth") === "1"
	);
}

export function useChatAuth() {
	const [authUser, setAuthUser] = useState<ChatUser | null>(null);
	const [userRole, setUserRole] = useState<string | null>(null);
	const [authLoading, setAuthLoading] = useState(true);

	useEffect(() => {
		if (shouldBypassAuthForChatPerformance()) {
			setAuthUser(CHAT_PERF_TEST_USER);
			setUserRole("admin");
			setAuthLoading(false);
			return;
		}
		let mounted = true;
		const supabase = createClient();
		const loadUser = async () => {
			setAuthLoading(true);
			const profile = await fetchClientAuthHeaderData().catch(() => undefined);
			if (!mounted) return;
			if (profile === undefined) {
				setAuthLoading(false);
				return;
			}
			if (!profile.isLoggedIn || !profile.user) {
				setAuthUser(null);
				setUserRole(null);
				setAuthLoading(false);
				return;
			}
			const displayName =
				profile.user.displayName ??
				profile.user.email ??
				"Account";
			setAuthUser({
				id: profile.user.id,
				email: profile.user.email,
				name: displayName,
				avatarUrl: profile.user.avatarUrl,
			});
			setUserRole(profile.userRole ?? null);
			setAuthLoading(false);
		};
		loadUser();
		const { data: listener } = supabase.auth.onAuthStateChange(() => {
			loadUser();
		});
		return () => {
			mounted = false;
			listener.subscription.unsubscribe();
		};
	}, []);

	const handleSignOut = useCallback(async () => {
		const supabase = createClient();
		await supabase.auth.signOut();
		setAuthUser(null);
		setUserRole(null);
		window.location.href = "/sign-in";
	}, []);

	return {
		authLoading,
		authUser,
		handleSignOut,
		isAdmin: userRole === "admin",
		isAuthenticated: Boolean(authUser),
		userRole,
	};
}
