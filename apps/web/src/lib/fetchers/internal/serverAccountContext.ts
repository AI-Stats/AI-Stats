import { cookies } from "next/headers";
import { io } from "next/cache";
import { OBFUSCATE_INFO_COOKIE, parseObfuscateInfo } from "@/lib/obfuscation";
import { getServerIdentity } from "@/lib/auth/serverIdentity";

export async function getServerAccountContext(): Promise<{
	accessToken: string | null;
	obfuscateInfo: boolean | null;
	workspaceId: string | null;
}> {
	// Session loading reads the current time. Mark this
	// shared auth boundary as request-time work so Cache Components never try
	// to capture that session state in a prerendered shell.
	await io();
	const [cookieStore, identity] = await Promise.all([cookies(), getServerIdentity()]);
	return {
		accessToken: identity?.session.token ?? null,
		obfuscateInfo: parseObfuscateInfo(
			cookieStore.get(OBFUSCATE_INFO_COOKIE)?.value ?? null,
		),
		workspaceId:
			String(cookieStore.get("activeWorkspaceId")?.value ?? "").trim() || null,
	};
}
