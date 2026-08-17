import { betterAuthClient } from "@/lib/auth/betterAuthClient";

export async function postClientAuthSignOut() {
	const { error } = await betterAuthClient.signOut();
	if (error) throw error;
}
