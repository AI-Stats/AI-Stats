import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";

const env = {
	ENV: "development" as const,
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_ANON_KEY: "anon-key",
	SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
	PHASEO_MANAGEMENT_KEY: "management-key",
	PHASEO_CONTROL_SECRET: "control-secret",
	GATEWAY_API_ORIGIN: "https://gateway.example.com",
};

afterEach(() => vi.unstubAllGlobals());

describe("account policy settings routes", () => {
	it("invalidates every active key after response-healing policy changes", async () => {
		const invalidated: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = request.url;
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ role: "admin" }]), { status: 200 });
			if (url.includes("/workspaces")) return new Response(JSON.stringify([{ owner_user_id: "user-1" }]), { status: 200 });
			if (url.includes("workspace_settings")) return new Response(JSON.stringify([]), { status: 200 });
			if (url.includes("/keys?")) return new Response(JSON.stringify([{ id: "key-1" }, { id: "key-2" }]), { status: 200 });
			if (url.includes("/v1/keys/") && url.endsWith("/invalidate")) {
				invalidated.push(url);
				expect(request.headers.get("authorization")).toBe("Bearer management-key");
				expect(request.headers.get("x-control-secret")).toBe("control-secret");
				return new Response(null, { status: 204 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/routing", {
			method: "PUT",
			headers: { authorization: "Bearer session-token", "content-type": "application/json" },
			body: JSON.stringify({
				workspaceId: "workspace-1",
				responseHealingEnabled: true,
				responseHealingLocked: true,
				responseHealingMode: "strict",
			}),
		}, env);

		expect(response.status).toBe(200);
		expect(invalidated).toEqual([
			"https://gateway.example.com/v1/keys/key-1/invalidate",
			"https://gateway.example.com/v1/keys/key-2/invalidate",
		]);
	});
	it("does not expose upstream versions when the source preset is no longer public", async () => {
		const requestedUrls: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			requestedUrls.push(url);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ role: "member" }]), { status: 200 });
			if (url.includes("/presets") && url.includes("workspace_id=eq.workspace-1")) {
				return new Response(JSON.stringify([{ id: "fork-1", workspace_id: "workspace-1", created_by: "user-1", source_preset_id: "source-1", upstream_version_id: "version-1", name: "Fork", visibility: "private" }]), { status: 200 });
			}
			if (url.includes("/presets") && url.includes("id=in.%28source-1%29")) return new Response(JSON.stringify([]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/presets/list?workspaceId=workspace-1", {
			headers: { authorization: "Bearer session-token" },
		}, env);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			presets: [{ id: "fork-1", latestUpstreamVersion: null, hasUpstreamUpdate: false }],
		});
		expect(requestedUrls.some((url) => url.includes("visibility=eq.public") && url.includes("archived_at=is.null"))).toBe(true);
		expect(requestedUrls.some((url) => url.includes("/preset_versions"))).toBe(false);
	});

	it("continues to advertise public versions from a public source preset", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ role: "member" }]), { status: 200 });
			if (url.includes("/presets") && url.includes("workspace_id=eq.workspace-1")) {
				return new Response(JSON.stringify([{ id: "fork-1", workspace_id: "workspace-1", created_by: "user-1", source_preset_id: "source-1", upstream_version_id: "version-1", name: "Fork", visibility: "private" }]), { status: 200 });
			}
			if (url.includes("/presets") && url.includes("id=in.%28source-1%29")) return new Response(JSON.stringify([{ id: "source-1" }]), { status: 200 });
			if (url.includes("/preset_versions")) return new Response(JSON.stringify([{ id: "version-2", preset_id: "source-1", version_number: 2 }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/presets/list?workspaceId=workspace-1", {
			headers: { authorization: "Bearer session-token" },
		}, env);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			presets: [{ id: "fork-1", latestUpstreamVersion: { id: "version-2", version_number: 2 }, hasUpstreamUpdate: true }],
		});
	});

	it("rejects a non-public source version when creating a fork", async () => {
		const requestedUrls: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			requestedUrls.push(url);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ role: "member" }]), { status: 200 });
			if (url.includes("/presets") && url.includes("id=eq.source-1")) return new Response(JSON.stringify([{ id: "source-1", name: "Source", slug: "source", description: null, config: { safe: true }, visibility: "public", active_version_id: "version-1" }]), { status: 200 });
			if (url.includes("/preset_versions")) return new Response(JSON.stringify([]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/presets/source-1/fork", {
			method: "POST",
			headers: { authorization: "Bearer session-token", "content-type": "application/json" },
			body: JSON.stringify({ workspaceId: "workspace-1", sourceVersionId: "private-version" }),
		}, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: "invalid_source_version" });
		expect(requestedUrls.some((url) => url.includes("/preset_versions") && url.includes("visibility=eq.public"))).toBe(true);
	});

	it("returns private routing, preset, and guardrail payloads", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (url.includes("workspace_members") && url.includes("teams%3Aworkspaces")) return new Response(JSON.stringify([{ workspace_id: "workspace-1", teams: { id: "workspace-1", name: "Team One" } }]), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ role: "admin" }]), { status: 200 });
			if (url.includes("/workspaces") && url.includes("owner_user_id")) return new Response(JSON.stringify([{ owner_user_id: "user-1" }]), { status: 200 });
			if (url.includes("/workspaces")) return new Response(JSON.stringify([{ id: "workspace-1", name: "Team One" }]), { status: 200 });
			if (url.includes("workspace_settings")) return new Response(JSON.stringify([{ routing_mode: "latency", response_healing_enabled: true, response_healing_locked: false, response_healing_mode: "strict", alpha_channel_enabled: true, beta_channel_enabled: false }]), { status: 200 });
			if (url.includes("gateway_dynamic_routes")) return new Response(JSON.stringify([{ id: "route-1", workspace_id: "workspace-1", name: "Production", status: "active", version: 2, config: { cacheAwareRouting: true } }]), { status: 200 });
			if (url.includes("gateway_dynamic_route_keys")) return new Response(JSON.stringify([{ route_id: "route-1", key_id: "key-1" }]), { status: 200 });
			if (url.includes("v2_public_provider_health_daily")) return new Response(JSON.stringify([{ provider_slug: "openai", attempt_count: 100, failed_attempts: 12, latency_sum_ms: 450000, latency_count: 100 }]), { status: 200 });
			if (url.includes("/presets")) return new Response(JSON.stringify([{ id: "preset-1", workspace_id: "workspace-1", name: "Fast" }]), { status: 200 });
			if (url.includes("/keys")) return new Response(JSON.stringify([{ id: "key-1", name: "Production", prefix: "ph_", status: "active" }]), { status: 200 });
			if (url.includes("v2_providers")) return new Response(JSON.stringify([{ api_provider_id: "openai", api_provider_name: "OpenAI", status: "active", routing_enabled: true }]), { status: 200 });
			if (url.includes("data_api_provider_models")) return new Response(JSON.stringify([{ provider_id: "openai", api_model_id: "gpt-test", internal_model_id: "openai/gpt-test", is_active_gateway: true }]), { status: 200 });
			if (url.includes("workspace_guardrails")) return new Response(JSON.stringify([{ id: "guardrail-1", workspace_id: "workspace-1", name: "Default", enabled: true }]), { status: 200 });
			if (url.includes("key_guardrails")) return new Response(JSON.stringify([{ guardrail_id: "guardrail-1", key_id: "key-1" }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));
		const init = { headers: { authorization: "Bearer session-token" } };
		const [routing, presets, guardrails, editor, dynamicRoutes] = await Promise.all([
			app.request("https://phaseo.app/api/account/settings/routing?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/presets?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/guardrails?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/guardrails/editor?workspaceId=workspace-1&mode=edit&guardrailId=guardrail-1", init, env),
			app.request("https://phaseo.app/api/account/settings/dynamic-routes?workspaceId=workspace-1", init, env),
		]);
		for (const response of [routing, presets, guardrails, editor, dynamicRoutes]) {
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
		}
		await expect(routing.json()).resolves.toMatchObject({ routingMode: "latency", responseHealingEnabled: true, responseHealingMode: "strict", teamName: "Team One" });
		await expect(presets.json()).resolves.toMatchObject({ currentUserId: "user-1", teamsWithPresets: [{ id: "workspace-1", presets: [{ id: "preset-1" }] }] });
		await expect(guardrails.json()).resolves.toMatchObject({ guardrails: [{ id: "guardrail-1" }], guardrailKeyIdsByGuardrailId: { "guardrail-1": ["key-1"] }, keys: [{ id: "key-1" }] });
		await expect(editor.json()).resolves.toMatchObject({ mode: "edit", guardrail: { id: "guardrail-1" }, initialKeyIds: ["key-1"], teamName: "Team One" });
		await expect(dynamicRoutes.json()).resolves.toMatchObject({
			routes: [{ id: "route-1", keyIds: ["key-1"] }],
			providers: [{ id: "openai", name: "OpenAI", status: "active", routingStatus: "active" }],
			suggestions: [{ providerId: "openai", severity: "warning" }],
		});
	});

	it("replaces dynamic route key assignments through the atomic RPC", async () => {
		let rpcBody: Record<string, unknown> | null = null;
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = request.url;
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (url.includes("/rpc/replace_gateway_dynamic_route_keys")) {
				rpcBody = await request.json<Record<string, unknown>>();
				return new Response("null", { status: 200 });
			}
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ role: "admin" }]), { status: 200 });
			if (url.includes("/workspaces")) return new Response(JSON.stringify([{ owner_user_id: "user-1" }]), { status: 200 });
			if (url.includes("gateway_dynamic_routes")) return new Response(JSON.stringify([{ id: "route-1", workspace_id: "workspace-1", version: 1 }]), { status: 200 });
			if (url.includes("gateway_dynamic_route_keys")) return new Response(JSON.stringify([{ key_id: "key-old" }]), { status: 200 });
			if (url.includes("/keys?")) return new Response(JSON.stringify([{ id: "key-1" }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/dynamic-routes/route-1/keys", {
			method: "PUT",
			headers: { authorization: "Bearer session-token", "content-type": "application/json" },
			body: JSON.stringify({ keyIds: ["key-1"] }),
		}, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);

		expect(response.status).toBe(200);
		expect(rpcBody).toEqual({
			p_route_id: "route-1",
			p_key_ids: ["key-1"],
			p_attached_by: "user-1",
		});
	});
});
