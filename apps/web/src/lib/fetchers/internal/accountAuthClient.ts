import { betterAuthClient } from "@/lib/auth/betterAuthClient";

export async function getBrowserAccessToken(): Promise<string | null> {
	const { data } = await betterAuthClient.getSession();
	return data?.session.token ?? null;
}
