import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({ PHASEO_THIRD_PARTY_OAUTH_ENABLED: true }),
	getSupabaseAdmin: () => ({
		from: () => ({
			select: () => ({
				eq: () => ({
					eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
				}),
			}),
		}),
	}),
}));

import { loadOAuthClient } from "./service";

afterEach(() => vi.unstubAllGlobals());

describe("OAuth client ID metadata documents", () => {
	it("loads a validated public CIMD client without dynamic registration", async () => {
		const clientId = "https://client.example/.well-known/oauth-client";
		const fetchMock = vi.fn().mockResolvedValue(Response.json({
			client_id: clientId,
			client_name: "Example MCP Client",
			client_uri: "https://client.example/",
			logo_uri: "https://client.example/logo.png",
			redirect_uris: ["https://client.example/oauth/callback"],
			grant_types: ["authorization_code"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
			scope: "models:read providers:read pricing:read",
		}));
		vi.stubGlobal("fetch", fetchMock);

		await expect(loadOAuthClient(clientId)).resolves.toMatchObject({
			id: clientId,
			name: "Example MCP Client",
			client_type: "public",
			redirect_uris: ["https://client.example/oauth/callback"],
			allowed_scopes: ["models:read", "providers:read", "pricing:read"],
			registration_source: "cimd",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			new URL(clientId),
			expect.objectContaining({ redirect: "error" }),
		);
	});

	it("rejects metadata that does not bind itself to the exact client_id", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
			client_id: "https://attacker.example/client.json",
			client_name: "Wrong Client",
			redirect_uris: ["https://attacker.example/callback"],
		})));

		await expect(loadOAuthClient("https://mismatch.example/client.json")).resolves.toBeNull();
	});

	it("does not fetch non-HTTPS or root-path client identifiers", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(loadOAuthClient("http://client.example/client.json")).resolves.toBeNull();
		await expect(loadOAuthClient("https://client.example/")).resolves.toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
