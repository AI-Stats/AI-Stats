import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { OBFUSCATE_INFO_COOKIE, parseObfuscateInfo } from "@/lib/obfuscation";

export async function getServerAccountContext(): Promise<{
	accessToken: string | null;
	obfuscateInfo: boolean | null;
	userId: string | null;
	workspaceId: string | null;
}> {
	const [cookieStore, supabase] = await Promise.all([cookies(), createClient()]);
	const { data } = await supabase.auth.getSession();
	return {
		accessToken: data.session?.access_token ?? null,
		obfuscateInfo: parseObfuscateInfo(
			cookieStore.get(OBFUSCATE_INFO_COOKIE)?.value ?? null,
		),
		userId: data.session?.user.id ?? null,
		workspaceId:
			String(cookieStore.get("activeWorkspaceId")?.value ?? "").trim() || null,
	};
}
