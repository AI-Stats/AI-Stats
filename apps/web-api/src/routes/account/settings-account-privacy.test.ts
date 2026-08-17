import { afterEach, describe, expect, it, vi } from "vitest";
const privacyRepo = vi.hoisted(() => ({ loadAccountPrivacy: vi.fn(), validatePrivacyRoutes: vi.fn(), saveAccountPrivacy: vi.fn(), listManagedChatKeyIds: vi.fn() }));
vi.mock("@/repositories/account-privacy", () => privacyRepo);
import app from "@/index";

const env = {
	ENV: "development" as const,
	PHASEO_CONTROL_KEY: "control-key",
	PHASEO_CONTROL_SECRET: "control-secret",
	GATEWAY_API_ORIGIN: "https://gateway.example.com",
};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("account privacy settings", () => {
	it("only lists providers backed by active gateway routes", async () => {
		privacyRepo.loadAccountPrivacy.mockResolvedValue({ policy: null, providers: [{ id: "openai", name: "OpenAI" }, { id: "302ai", name: "302.AI" }, { id: "openrouter", name: "OpenRouter" }], routes: [{ model_slug: "openai/gpt-5", provider_slug: "openai" }], models: [{ id: "openai/gpt-5", name: "GPT-5", organisationId: "openai", organisationName: "OpenAI" }] });
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			if (request.url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (request.url.includes("account_guardrail_settings")) return new Response(JSON.stringify([]), { status: 200 });
			if (request.url.includes("v2_providers")) return new Response(JSON.stringify([
				{ id: "openai", name: "OpenAI" },
				{ id: "302ai", name: "302.AI" },
				{ id: "openrouter", name: "OpenRouter" },
			]), { status: 200 });
			if (request.url.includes("v2_model_provider_routes")) return new Response(JSON.stringify([{ model_slug: "openai/gpt-5", provider_slug: "openai" }]), { status: 200 });
			if (request.url.includes("v2_models")) return new Response(JSON.stringify([{ id: "openai/gpt-5", name: "GPT-5", organisation: { lab_slug: "openai", name: "OpenAI" } }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/account/privacy", {
			headers: { authorization: "Bearer session-token" },
		}, env);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ providers: [{ id: "openai" }] });
	});

	it("rejects provider restrictions without an active gateway route", async () => {
		privacyRepo.validatePrivacyRoutes.mockResolvedValue({ providerIds: new Set(), modelIds: new Set() });
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			if (request.url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/account/privacy", {
			method: "PUT",
			headers: { authorization: "Bearer session-token", "content-type": "application/json" },
			body: JSON.stringify({ providerRestrictionMode: "blocklist", providerRestrictionProviderIds: ["302ai"], modelRestrictionMode: "none", modelRestrictionModelIds: [] }),
		}, env);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: "invalid_route_restriction" });
	});

	it("reports a persisted policy as saved with a pending warning when cache invalidation fails", async () => {
		privacyRepo.validatePrivacyRoutes.mockResolvedValue({ providerIds: new Set(), modelIds: new Set() });
		privacyRepo.saveAccountPrivacy.mockResolvedValue(undefined);
		privacyRepo.listManagedChatKeyIds.mockResolvedValue(["key-1"]);
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			if (request.url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", email: "user@example.com", created_at: "2025-01-01" }), { status: 200 });
			if (request.url.includes("account_guardrail_settings")) return new Response(JSON.stringify([]), { status: 201 });
			if (request.url.includes("/keys?")) return new Response(JSON.stringify([{ id: "key-1" }]), { status: 200 });
			if (request.url.includes("/v1/keys/key-1/invalidate")) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/account/settings/account/privacy", {
			method: "PUT",
			headers: { authorization: "Bearer session-token", "content-type": "application/json" },
			body: JSON.stringify({
				privacyEnablePaidMayTrain: true,
				privacyEnableFreeMayTrain: true,
				privacyEnableInputOutputLogging: true,
				privacyZdrOnly: false,
				providerRestrictionMode: "none",
				providerRestrictionProviderIds: [],
				modelRestrictionMode: "none",
				modelRestrictionModelIds: [],
			}),
		}, env);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ ok: true, cacheInvalidationPending: true });
	});
});
