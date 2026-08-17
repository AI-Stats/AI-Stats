import "server-only";

import { evaluateTeamSsoEnforcementNoop } from "@/lib/auth/ssoEnforcement";
import { fetchAccountWebApi } from "@/lib/web-api/client";
import { getServerAccountContext } from "@/lib/fetchers/internal/serverAccountContext";
import { requireServerIdentity } from "@/lib/auth/serverIdentity";

export async function requireAuthenticatedUser(): Promise<{
	user: { id: string; email?: string | null };
}> {
	const { user } = await requireServerIdentity();

	return {
		user: { id: user.id, email: user.email ?? null },
	};
}

export async function requireWorkspaceMembership(
	userId: string,
	workspaceId: string,
	roles?: Array<"owner" | "admin" | "member">,
): Promise<void> {
	if (!userId || !workspaceId) throw new Error("Unauthorized");

	const { accessToken } = await getServerAccountContext();
	if (!accessToken) throw new Error("Unauthorized");
	const query = new URLSearchParams({ workspaceId });
	if (roles?.length) query.set("roles", roles.join(","));
	const access = await fetchAccountWebApi<{ allowed: boolean; userId: string | null }>(`/api/account/auth/workspace-access?${query.toString()}`, accessToken).catch(() => null);
	if (!access?.allowed || access.userId !== userId) throw new Error("Unauthorized");

	await evaluateTeamSsoEnforcementNoop({
		workspaceId,
		userId,
		authMethod: "unknown",
		source: "server_action",
	});
}

export function requireActingUser(
	expectedUserId: string,
	actualUserId: string,
) {
	if (!expectedUserId || expectedUserId !== actualUserId) {
		throw new Error("Unauthorized");
	}
}
