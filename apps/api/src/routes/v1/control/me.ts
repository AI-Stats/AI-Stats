import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { getIdentityUserById } from "@/runtime/identity";
import { listUserWorkspaces } from "@/repositories/workspace-members";
import { authenticateManagement } from "@/pipeline/before/auth";
import { json, withRuntime } from "@/routes/utils";

export const meRoutes = new Hono<Env>();

meRoutes.get(
	"/",
	withRuntime(async (req) => {
		const auth = await authenticateManagement(req, { useKvCache: false });
		if (!auth.ok || auth.authMethod !== "oauth" || !auth.userId || !auth.oauthClientId) {
			return json(
				{ error: "unauthorised", message: "Bearer OAuth token is invalid or expired" },
				401,
				{ "Cache-Control": "no-store" },
			);
		}

		const scopes = auth.oauthScopes ?? auth.scopes ?? [];
		if (!scopes.includes(CAPABILITIES.ME_READ)) {
			return json(
				{ error: "insufficient_scope", message: `Token requires ${CAPABILITIES.ME_READ}` },
				403,
				{ "Cache-Control": "no-store" },
			);
		}
		const [userResult, membershipRows] = await Promise.all([
			getIdentityUserById(auth.userId),
			listUserWorkspaces(auth.userId),
		]);

		const user = userResult.data?.user;
		const workspaces = membershipRows.map((row) => ({ ...row, current: row.id === auth.workspaceId }));

		return json(
			{
				data: {
					user: {
						id: auth.userId,
						email: user?.email ?? null,
						name: user?.name ?? null,
					},
					oauth: {
						client_id: auth.oauthClientId,
						scopes,
						resource: auth.oauthResource ?? null,
					},
					current_workspace_id: auth.workspaceId,
					workspaces,
				},
			},
			200,
			{ "Cache-Control": "no-store" },
		);
	}),
);
