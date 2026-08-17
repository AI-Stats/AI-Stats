import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	thirdPartyOAuthEnabled: false,
	metadataRows: [] as Array<Record<string, unknown> | null>,
	insertPayloads: [] as Array<Record<string, unknown>>,
	operations: [] as string[],
}));

vi.mock("@/runtime/env", () => ({
	configureRuntime: () => undefined,
	clearRuntime: () => undefined,
	getBindings: () => ({
		PHASEO_THIRD_PARTY_OAUTH_ENABLED: state.thirdPartyOAuthEnabled ? "true" : undefined,
		PHASEO_OAUTH_TOKEN_PEPPER_ACTIVE: "test-oauth-pepper",
	}),
}));

vi.mock("@/pipeline/before/guards", () => ({
	guardManagementAuth: vi.fn(async () => ({
		ok: true,
		value: {
			workspaceId: "ws_attacker",
			userId: "user_1",
			apiKeyId: "mgmt_1",
			authMethod: "api_key",
			scopes: ["oauth_clients:write", "oauth_clients:delete"],
		},
	})),
}));

vi.mock("@/repositories/oauth", () => ({
	resolveWorkspaceOwnerUserId: vi.fn(async () => "user_1"),
	createOAuthAppMetadata: vi.fn(async (payload: Record<string, unknown>) => {
		const row = {
			...payload,
			client_id: payload.clientId,
			workspace_id: payload.workspaceId,
			allowed_scopes: payload.allowedScopes,
			client_secret_hash: payload.clientSecretHash,
		};
		state.insertPayloads.push(row);
		return row;
	}),
	findOwnedOAuthApp: vi.fn(async () => state.metadataRows.shift() ?? null),
	updateOAuthAppMetadata: vi.fn(async () => state.metadataRows.shift() ?? null),
	deleteOAuthAppAndRevokeAuthorizations: vi.fn(async () => {
		if (!state.metadataRows.shift()) return false;
		state.operations.push("revoke-authorizations", "delete-metadata");
		return true;
	}),
	listOAuthAppsWithStats: vi.fn(async () => []),
	findOAuthAppWithStats: vi.fn(async () => null),
}));

describe("OAuth client management security", () => {
	beforeEach(() => {
		state.thirdPartyOAuthEnabled = false;
		state.metadataRows.length = 0;
		state.insertPayloads.length = 0;
		state.operations.length = 0;
		vi.resetModules();
	});

	it("keeps third-party OAuth client creation closed during the CLI beta", async () => {
		const { default: oauthClientsRoutes } = await import("./oauth-clients");
		const response = await oauthClientsRoutes.request("https://example.com/", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Partner App",
				redirect_uris: ["https://partner.example/callback"],
			}),
		});
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.error).toBe("third_party_oauth_disabled");
		expect(body.message).toContain("coming soon");
		expect(state.insertPayloads).toHaveLength(0);
	});

	it("does not update upstream redirect URIs before local client ownership is proven", async () => {
		state.thirdPartyOAuthEnabled = true;
		const { default: oauthClientsRoutes } = await import("./oauth-clients");
		const response = await oauthClientsRoutes.request("https://example.com/victim_client", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				redirect_uris: ["https://attacker.example/callback"],
			}),
		});
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe("OAuth app not found");
		expect(state.metadataRows).toHaveLength(0);
	});

	it("includes explicit gateway access in new third-party client defaults", async () => {
		state.thirdPartyOAuthEnabled = true;
		const { default: oauthClientsRoutes } = await import("./oauth-clients");
		const response = await oauthClientsRoutes.request("https://example.com/", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Partner App",
				redirect_uris: ["https://partner.example/callback"],
			}),
		});

		expect(response.status).toBe(201);
		expect(state.insertPayloads).toHaveLength(1);
		expect(state.insertPayloads[0]?.allowed_scopes).toContain("gateway:access");
	});

	it("revokes delegated authorizations before deleting an OAuth client", async () => {
		state.thirdPartyOAuthEnabled = true;
		state.metadataRows.push({ client_id: "owned_client" });
		const { default: oauthClientsRoutes } = await import("./oauth-clients");
		const response = await oauthClientsRoutes.request("https://example.com/owned_client", {
			method: "DELETE",
		});

		expect(response.status).toBe(200);
		expect(state.operations).toEqual([
			"revoke-authorizations",
			"delete-metadata",
		]);
	});
});
