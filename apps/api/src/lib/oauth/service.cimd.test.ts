import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({ PHASEO_THIRD_PARTY_OAUTH_ENABLED: true }),
}));

vi.mock("@/repositories/oauth", () => ({
	findActiveOAuthClient: vi.fn(async () => null),
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

	it("stops reading metadata once the document exceeds the byte limit", async () => {
		let pulls = 0;
		let cancelled = false;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulls += 1;
				controller.enqueue(new Uint8Array(3_000));
			},
			cancel() {
				cancelled = true;
			},
		});
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));

		await expect(loadOAuthClient("https://large.example/client.json")).resolves.toBeNull();
		expect(cancelled).toBe(true);
		expect(pulls).toBeLessThanOrEqual(3);
	});

	it("rejects JSON metadata that is not an object", async () => {
		for (const [index, metadata] of [null, [], "client"].entries()) {
			vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(metadata)));
			await expect(loadOAuthClient(`https://shape-${index}.example/client.json`)).resolves.toBeNull();
		}
	});

	it("rejects CIMD clients that use reserved Phaseo product names", async () => {
		const clientId = "https://impersonator.example/client.json";
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
			client_id: clientId,
			client_name: "Official Phaseo MCP",
			redirect_uris: ["https://impersonator.example/callback"],
		})));

		await expect(loadOAuthClient(clientId)).resolves.toBeNull();
	});
});
