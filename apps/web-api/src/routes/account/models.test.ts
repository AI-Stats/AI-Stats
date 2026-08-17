import { afterEach, describe, expect, it, vi } from "vitest";
const adminModels = vi.hoisted(() => ({
	getModelSubscriptionPlans: vi.fn(async () => []),
	getAdminCatalogueCounts: vi.fn(async () => ({ models: 1, organisations: 1, providers: 1, benchmarks: 1 })),
	getAdminCatalogueRecord: vi.fn(async () => ({ row: null })),
	getAdminModelFormOptions: vi.fn(async () => ({ organisations: [], providers: [], families: [], benchmarks: [], previousModels: [], subscriptionPlans: [] })),
	isAdminUser: vi.fn(async () => true),
	listAdminCatalogue: vi.fn(async () => ({ rows: [], count: 0 })),
	loadAdminModelAuditSource: vi.fn(async () => ({ models: [], providerRows: [], benchmarkRows: [], pricingRows: [] })),
	loadAdminModelSource: vi.fn(async () => ({ modelId: "openai/gpt-test", model: null, links: [], details: [] })),
	loadAdminProviderAuditSource: vi.fn(async () => ({ providerModels: [], pricingRules: [] })),
	loadAdminPricingEditor: vi.fn(async () => ({
		model: { model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai" },
		routes: [{ provider_model_id: "openai:gpt-test", provider_slug: "openai", provider_model_slug: "gpt-test", status: "active", routing_enabled: false, input_modalities: ["text"], output_modalities: ["text"], regions: [], context_length: 128000, max_output_tokens: 4096, effective_from: null, effective_to: null }],
		skus: [], meters: [], serviceTiers: [], regions: [], capabilities: [], meterDefinitions: [], providers: [],
	})),
	mutateAdminCatalogue: vi.fn(async () => ({ before: null, after: { ok: true } })),
	mutateAdminModelGraph: vi.fn(async () => ({ model: { modelSlug: "openai/gpt-test" } })),
	mutateAdminPricingSku: vi.fn(async () => ({ sku: { skuId: "00000000-0000-4000-8000-000000000002" }, meters: [] })),
	mutateAdminProviderRoute: vi.fn(async () => ({ providerModelId: "external-provider:openai/gpt-test:gpt-test" })),
}));
vi.mock("@/repositories/identity", () => ({ findIdentityBySessionToken: vi.fn(async (_env, token: string) => token ? ({ id: "00000000-0000-4000-8000-000000000001", email: "admin@example.com", createdAt: "2026-01-01", appMetadata: {}, userMetadata: {} }) : null) }));
vi.mock("@/repositories/admin-models", () => adminModels);
import app from "@/index";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("account model source routes", () => {
	it.each([
		"/api/account/models/audit/source",
		"/api/account/models/provider-audit/source",
		"/api/account/models/openai%2Fgpt-test/source",
		"/api/account/models/openai%2Fgpt-test/pricing-editor",
	])("rejects unauthenticated access to %s with private cache headers", async (path) => {
		const response = await app.request(`https://phaseo.app${path}`, {}, { ENV: "development" });
		expect(response.status).toBe(401);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("vary")).toBe("Authorization, Cookie");
	});

	it.each([
		"/api/account/models/audit/source",
		"/api/account/models/openai%2Fgpt-test/pricing-editor",
	])("rejects authenticated non-admin access to %s", async (path) => {
		adminModels.isAdminUser.mockResolvedValueOnce(false);
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
			if (url.includes("/rest/v1/users")) return new Response(JSON.stringify({ role: "user" }), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			`https://phaseo.app${path}`,
			{ headers: { authorization: "Bearer session-token" } },
			{
				ENV: "development",
			},
		);
		expect(response.status).toBe(403);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("allows an admin to save a validated pricing SKU through the Drizzle repository", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }), { status: 200 });
			if (url.includes("/rest/v1/users")) return new Response(JSON.stringify({ role: "admin" }), { status: 200, headers: { "content-type": "application/json" } });
			return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/models/openai%2Fgpt-test/pricing-editor",
			{
				method: "PUT",
				headers: { authorization: "Bearer session-token", "content-type": "application/json" },
				body: JSON.stringify({
					provider_model_id: "openai:gpt-test",
					sku_code: "standard",
					version: 1,
					operation: "text.generate",
					status: "active",
					service_tier_slug: "standard",
					display_name: "Standard",
					currency: "USD",
					effective_from: "2026-08-10T10:00:00.000Z",
					meters: [{ meter_key: "input_tokens", modality: "text", direction: "input", unit: "token", unit_quantity: 1_000_000, price_nanos: 2_000_000_000, display_label: "Input tokens", display_unit: "1M tokens", billable: true, meter_order: 100, metadata: {} }],
				}),
			},
			{ ENV: "development" },
		);

		expect(response.status).toBe(200);
		expect(adminModels.mutateAdminPricingSku).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			actorUserId: "00000000-0000-4000-8000-000000000001",
			modelSlug: "openai/gpt-test",
			action: "save",
		}));
	});

	it("rejects an invalid pricing payload before invoking the database", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }), { status: 200 });
			if (url.includes("/rest/v1/users")) return new Response(JSON.stringify({ role: "admin" }), { status: 200, headers: { "content-type": "application/json" } });
			return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
		});
		vi.stubGlobal("fetch", fetchMock);
		const response = await app.request(
			"https://phaseo.app/api/account/models/openai%2Fgpt-test/pricing-editor",
			{ method: "PUT", headers: { authorization: "Bearer session-token", "content-type": "application/json" }, body: JSON.stringify({ meters: [] }) },
			{ ENV: "development" },
		);
		expect(response.status).toBe(400);
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("mutate_v2_admin_pricing_sku"))).toBe(false);
	});

	it("loads every editable provider-route field for the pricing editor", async () => {
		const requests: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			requests.push(url);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }), { status: 200 });
			if (url.includes("/rest/v1/users")) return new Response(JSON.stringify({ role: "admin" }), { status: 200, headers: { "content-type": "application/json" } });
			if (url.includes("/rest/v1/v2_models")) return new Response(JSON.stringify({ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai" }), { status: 200, headers: { "content-type": "application/json" } });
			return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/models/openai%2Fgpt-test/pricing-editor",
			{ headers: { authorization: "Bearer session-token" } },
			{ ENV: "development" },
		);

		expect(response.status).toBe(200);
		const payload = await response.json() as { routes: Array<Record<string, unknown>> };
		expect(payload.routes).toHaveLength(1);
		for (const field of ["input_modalities", "output_modalities", "context_length", "max_output_tokens", "effective_from", "effective_to"]) {
			expect(payload.routes[0]).toHaveProperty(field);
		}
		expect(adminModels.loadAdminPricingEditor).toHaveBeenCalledWith(expect.anything(), "openai/gpt-test", ["standard", "priority", "batch", "flex"]);
	});

	it("routes validated catalogue and model graph writes through audited Drizzle repositories", async () => {
		const requests: Array<{ url: string; body: string | null }> = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			requests.push({ url, body: typeof init?.body === "string" ? init.body : null });
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }), { status: 200 });
			if (url.includes("/rest/v1/users")) return new Response(JSON.stringify({ role: "admin" }), { status: 200, headers: { "content-type": "application/json" } });
			return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
		}));
		const env = { ENV: "development" as const };
		const headers = { authorization: "Bearer session-token", "content-type": "application/json" };

		const organisation = await app.request("https://phaseo.app/api/account/models/catalog/organisations", { method: "POST", headers, body: JSON.stringify({ organisation_id: "test-lab", name: "Test Lab", social_links: [] }) }, env);
		const graph = await app.request("https://phaseo.app/api/account/models/openai%2Fgpt-test/graph", { method: "PUT", headers, body: JSON.stringify({ modelId: "openai/gpt-test", name: "GPT Test", organisation_id: "openai" }) }, env);
		const route = await app.request("https://phaseo.app/api/account/models/openai%2Fgpt-test/provider-routes", { method: "PUT", headers, body: JSON.stringify({ provider_slug: "external-provider", provider_model_slug: "gpt-test", status: "active", routing_enabled: false }) }, env);

		expect(organisation.status).toBe(200);
		expect(graph.status).toBe(200);
		expect(route.status).toBe(200);
		expect(adminModels.mutateAdminCatalogue).toHaveBeenCalledOnce();
		expect(adminModels.mutateAdminModelGraph).toHaveBeenCalledOnce();
		expect(adminModels.mutateAdminProviderRoute).toHaveBeenCalledOnce();
	});
});
