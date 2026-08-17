import { requireUser, type AuthenticatedUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { getWorkspaceAccess } from "@/repositories/workspace-access";

export type AccountWorkspaceContext = {
	user: AuthenticatedUser;
	workspaceId: string;
	role: string;
};

function cookieValue(request: Request, name: string): string | null {
	for (const segment of (request.headers.get("cookie") ?? "").split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
		const value = segment.slice(separator + 1).trim();
		try { return decodeURIComponent(value) || null; } catch { return value || null; }
	}
	return null;
}

export async function requireAccountWorkspace(args: {
	request: Request;
	env: Env;
	workspaceId?: string | null;
}): Promise<AccountWorkspaceContext | null> {
	const user = await requireUser(args.request, args.env);
	const workspaceId = String(
		args.workspaceId ?? cookieValue(args.request, "activeWorkspaceId") ?? "",
	).trim();
	if (!user || !workspaceId) return null;
	const access = await getWorkspaceAccess(args.env, user.id, workspaceId);
	if (!access) return null;
	return {
		user,
		workspaceId,
		role: access.role,
	};
}
