import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/page-catalogue", () => ({
	listPublicModelsPageRows: vi.fn(async () => []),
	listPublicModelWeeklyMetrics: vi.fn(async () => []),
}));

vi.mock("@/repositories/model-aliases", () => ({
	listActiveModelAliases: vi.fn(async () => []),
}));
vi.mock("@/repositories/free-router", () => ({
	listFreeRouterRows: vi.fn(async () => [
		{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", organisation_name: "OpenAI", provider_slug: "provider-a", provider_model_slug: "gpt-test-a", input_modalities: ["text"], output_modalities: ["text"], model_input_modalities: ["text", "image"], model_output_modalities: ["text"], requests_30d: 1, total_cost_nanos_30d: 125, last_routed_at: "2026-07-26T00:00:00Z" },
		{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", organisation_name: "OpenAI", provider_slug: "provider-b", provider_model_slug: "gpt-test-b", input_modalities: ["image"], output_modalities: ["text"], model_input_modalities: ["text", "image"], model_output_modalities: ["text"], requests_30d: 1, total_cost_nanos_30d: 125, last_routed_at: "2026-07-26T00:00:00Z" },
	]),
}));
vi.mock("@/repositories/model-pricing", () => ({ loadModelPricingSources: vi.fn(async (_env, variants: string[]) => variants.some((id) => id.includes("gpt-5.6-sol")) ? ({
	providerRows: [{ provider_api_model_id: "pm-1", provider_id: "openai", api_model_id: "openai/gpt-5.6-sol", model_id: "openai/gpt-5.6-sol", provider_model_slug: "gpt-5.6-sol", is_active_gateway: true, routing_status: "active", data_api_provider_model_capabilities: [{ capability_id: "text.generate", status: "active", params: {} }], data_api_providers: { api_provider_name: "OpenAI", routing_status: "active" } }],
	pricingRows: [{ rule_id: "standard-price", model_key: "openai:openai/gpt-5.6-sol:text.generate", capability_id: "text.generate", pricing_plan: "standard", meter: "input_text_tokens", unit: "token", unit_size: 1000000, price_per_unit: 1, currency: "USD" }, { rule_id: "batch-price", model_key: "openai:openai/gpt-5.6-sol:text.generate", capability_id: "text.generate", pricing_plan: "batch", meter: "input_text_tokens", unit: "token", unit_size: 1000000, price_per_unit: .5, currency: "USD" }],
}) : ({ providerRows: [], pricingRows: [
		{ rule_id: "old-input", model_key: "deepseek:deepseek/deepseek-v4-flash-0731:text.generate", capability_id: "text.generate", pricing_plan: "standard", meter: "input_text_tokens", unit: "token", unit_size: 1_000_000, price_per_unit: 0.14, currency: "USD", priority: 100, effective_from: "2026-07-01T00:00:00Z", effective_to: "2026-08-01T00:00:00Z", match: [], time_windows: [] },
		{ rule_id: "new-input", model_key: "deepseek:deepseek/deepseek-v4-flash-0731:text.generate", capability_id: "text.generate", pricing_plan: "standard", meter: "input_text_tokens", unit: "token", unit_size: 1_000_000, price_per_unit: 0.22, currency: "USD", priority: 100, effective_from: "2026-08-01T00:00:00Z", effective_to: null, match: [], time_windows: [{ label: "peak", timezone: "UTC", start_time: "01:00", end_time: "04:00", price_per_unit: 0.44 }] },
	] })) }));

vi.mock("@/repositories/model-usage", () => ({
	listModelUsageDaily: vi.fn(async () => []),
	listModelApps: vi.fn(async () => [{ app_id: "app-1", title: "Example", image_url: "https://example.com/app.png", url: "https://example.com", last_seen: "2026-07-17T00:00:00Z", requests: 4, success_requests: 3, total_tokens: 100 }]),
	getModelRealtimeStats: vi.fn(async () => ({ requestsInWindow: 2, latencyP50Ms: 200, throughputP50TokPerSec: 30 })),
	getModelTokenTrajectory: vi.fn(async () => ({ release_date: "2026-01-01T00:00:00.000Z", deprecation_date: null, points: [], token_milestones: [], successor_milestones: [] })),
	listModelPerformanceColos: vi.fn(async () => []),
}));
vi.mock("@/repositories/model-performance", () => ({
	getModelProviderHealthRows: vi.fn(async () => []),
	getModelPerformanceBundle: vi.fn(async () => ({
		performance: { last_24h: { total_requests: 12, successful_requests: 11 }, hourly_24h: [], provider_uptime_24h: [{ provider: "poolside", provider_name: "Poolside", requests: 11 }], provider_daily_7d: [{ day: "2026-07-23", provider: "poolside", provider_name: "Poolside", requests: 11 }], time_of_day_5d: [], quality_series: [] },
		health: [], cachedInput: { hourly_24h: [], provider_daily_7d: [{ day: "2026-07-23", provider: "poolside", cached_input_pct: 62.5, cached_input_tokens: 625, effective_input_tokens: 1000, telemetry_requests: 11 }] },
		percentileSeries: [50, 75, 90, 95, 99].map((percentile) => ({ usage_day: "2026-07-23", provider_id: "poolside", provider_name: "Poolside", percentile, gateway_ttft_ms: percentile === 95 ? 900 : 230, provider_duration_ms: percentile === 95 ? 1200 : 500, effective_throughput_tps: percentile === 95 ? 13.4 : 8.5, cached_input_pct: percentile === 95 ? 88.5 : 62.5, requests: 11 })),
	})),
}));
vi.mock("@/repositories/model-monitor", () => ({ listGatewayMonitorRows: vi.fn(async () => []) }));

vi.mock("@/repositories/models", () => ({
	findPublicModelIdentity: vi.fn(async () => ({
		model_slug: "openai/gpt-test",
		name: "GPT Test", description: null, status: "active", catalogue_status: "available", hidden: false, variant_kind: "standard", base_model_slug: null, previous_model_slug: null, replacement_model_slug: null, announced_at: null, released_at: null, deprecated_at: null, retired_at: null, removal_date: null, family_slug: null,
		license: "MIT",
		license_url: null,
		input_modalities: ["text"], output_modalities: ["text"], lab_slug: "openai", lab_name: "OpenAI", lab_country_code: "US",
	})),
	resolvePublicModel: vi.fn(async (_env, requestedModelId: string) => ({
		requestedModelId,
		canonicalModelId: requestedModelId,
		internalModelId: requestedModelId,
		source: "direct",
	})),
	listPublicModelVariants: vi.fn(async () => [
		{ model_id: "openai/gpt-test", name: "GPT Test", variant_kind: "standard" },
		{ model_id: "openai/gpt-test:free", name: "GPT Test (Free)", variant_kind: "free" },
	]),
	getModelAvailability: vi.fn(async () => ({
		is_gateway_active: true,
		active_provider_count: 1,
		active_route_count: 1,
		regions: [],
		service_tiers: [],
	})),
	listModelBenchmarks: vi.fn(async () => [{
		result_id: "result-1",
		benchmark_id: "mmlu",
		score: "0.85",
		score_numeric: "0.85",
		is_self_reported: false,
		other_info: null,
		source_link: "https://example.com",
		result_rank: 2,
		occur_idx: null,
		variant: null,
		result_key: null,
		benchmark_name: "MMLU",
		category: null,
		link: null,
		total_models: 50,
		ascending_order: true,
		benchmark_type: "percentage",
		created_at: null,
		updated_at: null,
	}]),
	getModelTimeline: vi.fn(async () => [
		{ date: "2026-08-01", eventType: "FutureModel", modelId: "openai/gpt-next", modelName: "GPT Next" },
		{ date: "2026-07-01", eventType: "ModelEvent", eventName: "Released" },
	]),
	listModelSubscriptionPlans: vi.fn(async () => [{
		plan_uuid: "plan-uuid",
		plan_id: "pro",
		name: "Pro",
		lab_slug: "phaseo",
		description: null,
		link: null,
		other_info: {},
		created_at: null,
		updated_at: null,
		model_info: { note: "included" },
		rate_limit: { rpm: 10 },
		model_other_info: null,
		price: "20",
		currency: "USD",
		frequency: "month",
	}]),
	listModelIdentifiers: vi.fn(async (_env, modelId: string) => [modelId]),
	getModelNotice: vi.fn(async () => ({
		apiModelId: "openai/gpt-test",
		tone: "warning",
		markdown: "This model is changing.",
	})),
	getProviderStatuses: vi.fn(async (_env, providerIds: string[]) => new Map(providerIds.map((id) => [id, id.toLowerCase() === "openrouter" ? "external" : "active"]))),
	getProviderMetadata: vi.fn(async (_env, providerIds: string[]) => new Map(providerIds.map((id) => [id, { colour: "#12AB78" }]))),
	getProviderRegions: vi.fn(async (_env, providerIds: string[]) => new Map(providerIds.map((id) => [id, id === "provider-a" ? ["us", "eu"] : ["us"]]))),
	listRecentProviderHealthStates: vi.fn(async () => [
		{ provider_id: "openai", breaker_state: "open", is_deranked: false, open_until_ms: Date.now() + 60_000, updated_at: new Date().toISOString() },
		{ provider_id: "openai", breaker_state: "half_open", is_deranked: false, open_until_ms: 0, updated_at: new Date().toISOString() },
	]),
	listCatalogPricingRules: vi.fn(async () => []),
	listPublicCatalogueModels: vi.fn(async () => ({
		rows: [{ model_slug: "openai/gpt-test", lab_slug: "openai", name: "GPT Test", description: null, status: "active", released_at: null, announced_at: null, updated_at: null, input_modalities: ["text"], output_modalities: ["text"], organisation: { name: "OpenAI", metadata: {} } }],
		total: 1,
	})),
}));

import app from "@/index";
import { getModelTokenTrajectory } from "@/repositories/model-usage";
import { loadModelPricingSources } from "@/repositories/model-pricing";
import { getModelPerformanceBundle } from "@/repositories/model-performance";
import { listGatewayMonitorRows } from "@/repositories/model-monitor";
import { getProviderRegions, listPublicCatalogueModels } from "@/repositories/models";
import { listPublicModelsPageRows } from "@/repositories/page-catalogue";

const env = {
	ENV: "development" as const,
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	vi.mocked(listGatewayMonitorRows).mockResolvedValue([]);
});

describe("public model routes", () => {
	it("keeps expired rules and time windows in pricing history", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("v2_model_provider_routes")) return new Response(JSON.stringify([{
				provider_model_id: "pm-1", provider_slug: "deepseek", model_slug: "deepseek/deepseek-v4-flash-0731",
				provider_model_slug: "deepseek-v4-flash", status: "active", routing_enabled: true,
			}]), { status: 200 });
			if (url.includes("v2_route_capabilities")) return new Response("[]", { status: 200 });
			if (url.includes("v2_providers")) return new Response(JSON.stringify([{
				provider_slug: "deepseek", name: "DeepSeek", status: "active", routing_enabled: true, metadata: {},
			}]), { status: 200 });
			if (url.includes("v2_pricing_skus")) return new Response(JSON.stringify([
				{ sku_id: "old", provider_model_id: "pm-1", service_tier_slug: "standard", operation: "text.generate", status: "active", currency: "USD", effective_from: "2026-07-01T00:00:00Z", effective_to: "2026-08-01T00:00:00Z", metadata: {} },
				{ sku_id: "new", provider_model_id: "pm-1", service_tier_slug: "standard", operation: "text.generate", status: "active", currency: "USD", effective_from: "2026-08-01T00:00:00Z", effective_to: null, metadata: { time_windows: [{ label: "peak", timezone: "UTC", start_time: "01:00", end_time: "04:00", price_per_unit: 0.44 }] } },
			]), { status: 200 });
			if (url.includes("v2_pricing_sku_meters")) return new Response(JSON.stringify([
				{ sku_meter_id: "old-input", sku_id: "old", meter_key: "input_text_tokens", unit: "token", unit_quantity: 1_000_000, price_nanos: 140_000_000, meter_order: 100, metadata: {} },
				{ sku_meter_id: "new-input", sku_id: "new", meter_key: "input_text_tokens", unit: "token", unit_quantity: 1_000_000, price_nanos: 220_000_000, meter_order: 100, metadata: {} },
			]), { status: 200 });
			return new Response("[]", { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models/deepseek%2Fdeepseek-v4-flash-0731/pricing-history?days=30",
			{},
			env,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			rules: [
				expect.objectContaining({ ruleId: "new-input", timeWindows: [expect.objectContaining({ label: "peak" })] }),
				expect.objectContaining({ ruleId: "old-input", effectiveTo: "2026-08-01T00:00:00Z", timeWindows: [] }),
			],
		});
	});

	it("includes the database-composed free router in page projection 5", async () => {
		vi.mocked(listPublicModelsPageRows).mockResolvedValueOnce([{
			model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", gateway_status: "active",
			gateway_input_modalities: ["text"], gateway_output_modalities: ["text"], gateway_features: [], gateway_tiers: [],
		}]);
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("v2_models")) return new Response(JSON.stringify([{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", input_modalities: ["text", "image"], output_modalities: ["text"], lab: { name: "OpenAI" } }]), { status: 200 });
			if (url.includes("v2_model_provider_routes")) return new Response(JSON.stringify([
				{ provider_slug: "provider-a", provider_model_slug: "gpt-test-a", model_slug: "openai/gpt-test", input_modalities: ["text"], output_modalities: ["text"], routing_enabled: true, status: "active", effective_from: null, effective_to: null },
				{ provider_slug: "provider-b", provider_model_slug: "gpt-test-b", model_slug: "openai/gpt-test", input_modalities: ["image"], output_modalities: ["text"], routing_enabled: true, status: "active", effective_from: null, effective_to: null },
			]), { status: 200 });
			if (url.includes("v2_request_facts")) return new Response(JSON.stringify([{
				request_event_id: "event-1", routed_model_slug: "openai/gpt-test", occurred_at: "2026-07-26T00:00:00Z",
			}]), { status: 200 });
			if (url.includes("v2_request_pricing_lines")) return new Response(JSON.stringify([{
				request_event_id: "event-1", charged_nanos: 125,
			}]), { status: 200 });
			return new Response("[]", { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/_web/models?catalogue_version=v2&shape=page&projection=5&limit=2000", {}, env);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-tag")).toContain("web-api-free-router-overview");
		await expect(response.json()).resolves.toMatchObject({
			projection: 5,
			total: 2,
			models: [
				{ model_id: "phaseo/free", gateway_provider_count: 2, gateway_input_modalities: ["image", "text"], router_requests_30d: 1, router_spend_nanos_30d: 125 },
				{ model_id: "openai/gpt-test" },
			],
			facets: { statusCounts: { active: 2 }, tierOptions: [{ value: "free", count: 1 }] },
		});
	});

	it("uses the complete V2 public catalogue projection by default", async () => {
		vi.mocked(listPublicModelsPageRows).mockResolvedValueOnce([
			{ model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", organisation_name: "OpenAI", primary_date: "2026-01-02", gateway_status: "active", gateway_provider_count: 1, gateway_active_provider_count: 1, gateway_endpoints: ["responses"], gateway_input_modalities: ["text"], gateway_output_modalities: ["text"], gateway_features: ["tools"], gateway_tiers: ["standard"], gateway_execution_regions: ["us"], gateway_provider_names: ["OpenAI"] },
			{ model_id: "openai/gpt-coming-soon", name: "GPT Coming Soon", organisation_id: "openai", organisation_name: "OpenAI", gateway_status: "coming_soon" },
			{ model_id: "openai/gpt-inactive", name: "GPT Inactive", organisation_id: "openai", organisation_name: "OpenAI", gateway_status: "not_active" },
		]);
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_public_model_catalogue_rows")) return new Response(JSON.stringify([{
				model_id: "openai/gpt-test", name: "Gateway name", organisation_id: "openai", organisation_name: "OpenAI",
				gateway_status: "active", gateway_provider_count: 1, gateway_active_provider_count: 1,
				gateway_endpoints: ["responses"], gateway_input_modalities: ["text"], gateway_output_modalities: ["text"],
				gateway_features: ["tools"], gateway_provider_names: ["OpenAI"], gateway_active_provider_names: ["OpenAI"],
				gateway_provider_details: [{ id: "openai", name: "OpenAI", status: "active", is_active: true }],
				gateway_api_model_ids: ["openai/gpt-test"], context_lengths: [128000], supported_parameters: ["temperature"],
			}]), { status: 200 });
			if (url.includes("data_models")) return new Response(JSON.stringify([{
				model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", description: "Compact model",
				release_date: "2026-01-02", input_types: ["text"], output_types: ["text"], organisation: { name: "OpenAI", colour: "#fff" },
			}]), { status: 200 });
			if (url.includes("get_v2_provider_region_map")) return new Response(JSON.stringify([{ provider_slug: "openai", regions: ["US"] }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request("https://phaseo.app/api/_web/models?shape=page&limit=2000", {}, env);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			shape: "page", pricing_complete: true, total: 3,
			models: [
				{ model_id: "openai/gpt-test", name: "GPT Test", gateway_execution_regions: ["us"], gateway_tiers: ["standard"] },
				{ model_id: "openai/gpt-coming-soon", gateway_status: "coming_soon" },
				{ model_id: "openai/gpt-inactive", gateway_status: "not_active" },
			],
			facets: { statusCounts: { active: 1, coming_soon: 1, not_active: 1 } },
		});
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("get_monitor_model_rows"))).toBe(false);
		expect(listPublicModelsPageRows).toHaveBeenCalledWith(env, { region: null, serviceTier: null });
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("get_public_model_catalogue_rows"))).toBe(false);
	});

	it("uses the route-scoped V2 projection for explicit region and service-tier filters", async () => {
		vi.mocked(listPublicModelsPageRows).mockResolvedValueOnce([{ model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", organisation_name: "OpenAI", gateway_status: "active" }]);
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_v2_public_models_page_rows")) {
				return new Response(JSON.stringify([{
					model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai",
					organisation_name: "OpenAI", gateway_status: "active",
				}]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/models?shape=page&projection=4&limit=2000&region=ca&service_tier=priority",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(listPublicModelsPageRows).toHaveBeenCalledWith(env, { region: "ca", serviceTier: "priority" });
	});

	it("serves the V2 models page from the compact page projection", async () => {
		vi.mocked(listPublicModelsPageRows).mockResolvedValueOnce([{
			model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", organisation_name: "OpenAI", primary_date: "2026-01-02", gateway_status: "active", gateway_provider_count: 1, gateway_active_provider_count: 1, gateway_endpoints: ["responses"], gateway_input_modalities: ["text"], gateway_output_modalities: ["text"], gateway_features: ["tools"], gateway_tiers: ["standard"], gateway_execution_regions: ["us"], gateway_provider_names: ["OpenAI"], lowest_standard_input_price: 0.3, lowest_standard_input_price_unit: "billing unit", lowest_standard_output_price: 1.2, lowest_standard_output_price_unit: "billing unit", pricing_detail_rows: [{ meter_key: "input_text_tokens", price: 0.3, display_unit: "1M tokens", unit_quantity: 1_000_000 }, { meter_key: "output_text_tokens", price: 1.2, display_unit: "1M tokens", unit_quantity: 1_000_000 }],
		}]);
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_public_models_page_rows")) return new Response(JSON.stringify([{
				model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", organisation_name: "OpenAI",
				primary_date: "2026-01-02", gateway_status: "active",
				gateway_provider_count: 1, gateway_active_provider_count: 1, gateway_endpoints: ["responses"],
				gateway_input_modalities: ["text"], gateway_output_modalities: ["text"], gateway_features: ["tools"],
				gateway_tiers: ["standard"], gateway_execution_regions: ["us"], gateway_provider_names: ["OpenAI"],
				lowest_standard_input_price: 0.3, lowest_standard_input_price_unit: "billing unit",
				lowest_standard_output_price: 1.2, lowest_standard_output_price_unit: "billing unit",
				pricing_detail_rows: [
					{ meter_key: "input_text_tokens", price: 0.3, display_unit: "1M tokens", unit_quantity: 1_000_000 },
					{ meter_key: "output_text_tokens", price: 1.2, display_unit: "1M tokens", unit_quantity: 1_000_000 },
				],
			}]), { status: 200 });
			if (url.includes("v2_models")) return new Response(JSON.stringify([{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", input_modalities: ["text"], output_modalities: ["text"], lab: { name: "OpenAI" } }]), { status: 200 });
			if (url.includes("v2_model_provider_routes")) return new Response(JSON.stringify([{ provider_slug: "openai", provider_model_slug: "gpt-test", model_slug: "openai/gpt-test", input_modalities: ["text"], output_modalities: ["text"], routing_enabled: true, status: "active", effective_from: null, effective_to: null }]), { status: 200 });
			if (url.includes("v2_request_facts")) return new Response(JSON.stringify([]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/models?catalogue_version=v2&shape=page&projection=6&limit=2000",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-tag")).toContain("web-api-models-v2");
		expect(response.headers.get("cache-tag")).toContain("web-api-free-router-overview");
		await expect(response.json()).resolves.toMatchObject({
			catalogue_version: "v2",
			shape: "page",
			projection: 6,
			pricing_complete: true,
			total: 2,
			models: [
				{ model_id: "phaseo/free" },
				{
					model_id: "openai/gpt-test",
					lowest_standard_input_price_unit: "1M tokens",
					lowest_standard_output_price_unit: "1M tokens",
					pricing_detail_rows: [
						{ label: "Input Text Tokens", value: "$0.3 / 1M tokens" },
						{ label: "Output Text Tokens", value: "$1.2 / 1M tokens" },
					],
				},
			],
			facets: { statusCounts: { active: 2 } },
		});
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("get_monitor_model_rows"))).toBe(false);
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("data_models?"))).toBe(false);
		expect(listPublicModelsPageRows).toHaveBeenCalled();
	});

	it("serves compact table rows without loading the nested model catalogue", async () => {
		const monitorRow = { model_id: "openai/gpt-test", api_model_id: "openai/gpt-test", model_name: "GPT Test", organisation_id: "openai", organisation_name: "OpenAI", provider_id: "openai", api_provider_name: "OpenAI", capability_id: "responses", capability_status: "active", is_active_gateway: true, input_modalities: ["text"], output_modalities: ["text"], capability_params: { properties: { temperature: { type: "number" } } }, input_price: 1, output_price: 2, context_length: 128000, provider_max_output_tokens: 4096, weekly_tokens_model: 100, weekly_tokens_model_provider: 250, model_release_date: "2026-01-02" };
		vi.mocked(listGatewayMonitorRows).mockResolvedValue([{ ...monitorRow, provider_api_model_id: "provider-model-a" }, { ...monitorRow, provider_api_model_id: "provider-model-b", input_price: .5 }]);
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_monitor_model_rows")) {
				const monitorRow = {
				model_id: "openai/gpt-test", api_model_id: "openai/gpt-test", model_name: "GPT Test",
				organisation_id: "openai", organisation_name: "OpenAI", provider_id: "openai",
				api_provider_name: "OpenAI", capability_id: "responses", capability_status: "active",
				is_active_gateway: true, input_modalities: ["text"], output_modalities: ["text"],
				capability_params: { properties: { temperature: { type: "number" } } },
				input_price: 1, output_price: 2, context_length: 128000,
				provider_max_output_tokens: 4096, weekly_tokens_model: 100,
				weekly_tokens_model_provider: 250, model_release_date: "2026-01-02",
				};
				return new Response(JSON.stringify([
					{ ...monitorRow, provider_api_model_id: "provider-model-a" },
					{ ...monitorRow, provider_api_model_id: "provider-model-b", input_price: 0.5 },
				]), { status: 200 });
			}
			if (url.includes("get_v2_provider_region_map")) return new Response(JSON.stringify([
				{ provider_slug: "openai", regions: ["US"] },
			]), { status: 200 });
			if (url.includes("v2_providers?")) return new Response(JSON.stringify([
				{ provider_slug: "openai", status: "active" },
			]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/models?catalogue_version=v2&shape=table&projection=2&limit=10000&revalidate=1",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=900, stale-while-revalidate=1800");
		expect(response.headers.get("cache-tag")).toContain("web-api-models-v2");
		const payload = await response.json() as {
			models: Array<{ id: string; provider: Record<string, unknown> }>;
			[key: string]: unknown;
		};
		expect(payload).toMatchObject({
			catalogue_version: "v2",
			shape: "table",
			projection: 2,
			total: 2,
			models: [{
				id: "openai/gpt-test::openai::provider-model-a::responses",
				modelId: "openai/gpt-test",
				provider: { id: "openai", inputPrice: 1, outputPrice: 2, executionRegions: ["us"] },
				endpoint: "responses",
				popularityTokensWeek: 250,
			}, {
				id: "openai/gpt-test::openai::provider-model-b::responses",
				provider: { inputPrice: 0.5 },
			}],
			facets: {
				endpoints: ["responses"],
				modalities: ["text"],
				features: [],
				statuses: ["active"],
			},
		});
		expect(new Set(payload.models.map((model) => model.id)).size).toBe(2);
		expect(payload.models[0].provider).not.toHaveProperty("standardInputPrice");
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("v2_models?"))).toBe(false);
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("data_models?"))).toBe(false);

		const cursorResponse = await app.request(
			"https://phaseo.app/api/_web/models?catalogue_version=v2&shape=table&projection=3&limit=1&revalidate=1",
			{},
			env,
		);
		expect(cursorResponse.status).toBe(200);
		expect(cursorResponse.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=0");
		await expect(cursorResponse.json()).resolves.toMatchObject({
			projection: 3,
			has_more: true,
			next_cursor: expect.any(String),
			models: [{ id: "openai/gpt-test::openai::provider-model-a::responses" }],
		});

		const monitorCallsBeforeInvalidCursor = vi.mocked(listGatewayMonitorRows).mock.calls.length;
		for (const malformedCursor of [
			{ providerModelId: "not-a-uuid", capabilityId: "responses" },
			{ providerModelId: "00000000-0000-0000-0000-000000000000", capabilityId: "" },
		]) {
			const encodedCursor = btoa(JSON.stringify(malformedCursor))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/g, "");
			const invalidCursorResponse = await app.request(
				`https://phaseo.app/api/_web/models?shape=table&projection=3&cursor=${encodedCursor}`,
				{},
				env,
			);
			expect(invalidCursorResponse.status).toBe(400);
			await expect(invalidCursorResponse.json()).resolves.toEqual({ error: "invalid_cursor" });
		}
		expect(listGatewayMonitorRows).toHaveBeenCalledTimes(monitorCallsBeforeInvalidCursor);

		const laterPageResponse = await app.request(
			"https://phaseo.app/api/_web/models?catalogue_version=v2&shape=table&projection=2&limit=10000&offset=20000",
			{},
			env,
		);
		expect(laterPageResponse.status).toBe(200);
		await expect(laterPageResponse.json()).resolves.toMatchObject({
			offset: 20_000,
			models: [],
		});
	});

	it("keeps free provider offers separate in the compact table projection", async () => {
		vi.mocked(listGatewayMonitorRows).mockResolvedValueOnce([{ model_id: "poolside/laguna-s-2.1", api_model_id: "poolside/laguna-s-2.1:free", model_name: "Laguna S 2.1", organisation_id: "poolside", organisation_name: "Poolside", provider_id: "poolside", provider_api_model_id: "poolside:poolside/laguna-s-2.1:free", api_provider_name: "Poolside", capability_id: "text.generate", capability_status: "active", is_active_gateway: true, is_free_variant: true, input_modalities: ["text"], output_modalities: ["text"] }]);
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_monitor_model_rows")) return new Response(JSON.stringify([{
				model_id: "poolside/laguna-s-2.1",
				api_model_id: "poolside/laguna-s-2.1:free",
				model_name: "Laguna S 2.1",
				organisation_id: "poolside",
				organisation_name: "Poolside",
				provider_id: "poolside",
				provider_api_model_id: "poolside:poolside/laguna-s-2.1:free",
				api_provider_name: "Poolside",
				capability_id: "text.generate",
				capability_status: "active",
				is_active_gateway: true,
				is_free_variant: true,
				input_modalities: ["text"],
				output_modalities: ["text"],
			}]), { status: 200 });
			if (url.includes("get_v2_provider_region_map")) return new Response(JSON.stringify([]), { status: 200 });
			if (url.includes("v2_providers?")) return new Response(JSON.stringify([
				{ provider_slug: "poolside", status: "active" },
			]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models?catalogue_version=v2&shape=table&projection=2&limit=10000",
			{},
			env,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			models: [{
				model: "Laguna S 2.1 (Free)",
				modelId: "poolside/laguna-s-2.1:free",
				tier: "free",
			}],
		});
	});

	it("does not fall back to the V1 catalogue when the Drizzle projection is unavailable", async () => {
		vi.mocked(listPublicModelsPageRows).mockRejectedValueOnce(new Error("database unavailable"));
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_public_model_catalogue_rows")) return new Response(JSON.stringify([{
				model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", gateway_status: "inactive",
				gateway_provider_details: [], gateway_api_model_ids: ["openai/gpt-test"], gateway_features: [],
			}]), { status: 200 });
			if (url.includes("data_models")) return new Response(JSON.stringify([{
				model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", input_types: ["text"], output_types: ["text"],
			}]), { status: 200 });
			if (url.includes("get_v2_provider_region_map")) return new Response(JSON.stringify([]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request("https://phaseo.app/api/_web/models?shape=page&projection=fallback-test", {}, env);
		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({ error: "models_unavailable" });
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("get_public_model_catalogue_rows"))).toBe(false);
	});

	it("supports the parallel V2 catalogue and rejects unknown versions", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_monitor_model_rows")) {
				return new Response(JSON.stringify([]), { status: 200 });
			}
			return new Response(
				JSON.stringify([
					{
						model_slug: "openai/gpt-test",
						name: "GPT Test",
						lab_slug: "openai",
					},
				]),
				{ status: 200, headers: { "content-range": "0-0/1" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const [v2, invalid] = await Promise.all([
			app.request("https://phaseo.app/api/_web/models?catalogue_version=v2", {}, env),
			app.request("https://phaseo.app/api/_web/models?catalogue_version=v3", {}, env),
		]);

		expect(v2.status).toBe(200);
		expect(await v2.json()).toMatchObject({
			catalogue_version: "v2",
			total: 1,
		});
		expect(v2.headers.get("cache-tag")).toBe("web-api-models,web-api-models-v2");
		expect(listPublicCatalogueModels).toHaveBeenCalled();
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("v2_models"))).toBe(false);
		expect(invalid.status).toBe(400);
	});

	it("preserves provider execution regions in gateway monitor rows", async () => {
		vi.mocked(listGatewayMonitorRows).mockResolvedValueOnce([{ model_id: "openai/gpt-test", api_model_id: "gpt-test", provider_id: "openai", provider_api_model_id: "pm-1", capability_id: "chat/completions", capability_status: "active", is_active_gateway: true }]);
		vi.mocked(getProviderRegions).mockResolvedValueOnce(new Map([["openai", ["us", "eu"]]]));
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_monitor_model_rows")) {
				return new Response(
					JSON.stringify([
						{
							model_id: "openai/gpt-test",
							api_model_id: "gpt-test",
							provider_id: "openai",
							capability_id: "chat/completions",
							capability_status: "active",
							is_active_gateway: true,
						},
					]),
					{ status: 200 },
				);
			}
			if (url.includes("get_v2_provider_region_map")) {
				return new Response(
					JSON.stringify([
						{ provider_slug: "openai", regions: ["US", "eu"] },
					]),
					{ status: 200 },
				);
			}
			return new Response(
				JSON.stringify([{ model_id: "openai/gpt-test", name: "GPT Test" }]),
				{ status: 200, headers: { "content-range": "0-0/1" } },
			);
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models?region-check=1",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			models: [
				{
					gateway_monitor_rows: [
						{ provider: { executionRegions: ["us", "eu"] } },
					],
				},
			],
		});
	});

	it("excludes external providers from models-page monitor rows", async () => {
		vi.mocked(listGatewayMonitorRows).mockResolvedValueOnce([{ model_id: "google/gemini-3.5-flash", api_model_id: "google/gemini-3.5-flash", provider_id: " OpenRouter ", provider_api_model_id: "pm-openrouter", capability_id: "text.generate", capability_status: "active", is_active_gateway: false }]);
		vi.mocked(listPublicCatalogueModels).mockResolvedValueOnce({
			rows: [{ model_slug: "google/gemini-3.5-flash", lab_slug: "google", name: "Gemini 3.5 Flash", description: null, status: "active", released_at: null, announced_at: null, updated_at: null, input_modalities: ["text"], output_modalities: ["text"], organisation: { name: "Google", metadata: {} } }],
			total: 1,
		});
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_monitor_model_rows")) {
				return new Response(JSON.stringify([
					{
						model_id: "google/gemini-3.5-flash",
						api_model_id: "google/gemini-3.5-flash",
						provider_id: " OpenRouter ",
						capability_id: "text.generate",
						capability_status: "active",
						is_active_gateway: false,
					},
				]), { status: 200 });
			}
			if (url.includes("v2_providers")) {
				return new Response(JSON.stringify([
					{ provider_slug: "openrouter", status: "external" },
				]), { status: 200 });
			}
			if (url.includes("get_v2_provider_region_map")) {
				return new Response(JSON.stringify([]), { status: 200 });
			}
			return new Response(JSON.stringify([
				{ model_slug: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash" },
			]), { status: 200, headers: { "content-range": "0-0/1" } });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models?catalogue_version=v2&external-status-check=1",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			models: [
				{
					model_id: "google/gemini-3.5-flash",
					gateway_monitor_rows: [],
				},
			],
		});
	});

	it("applies a distinct cache profile to the catalogue, benchmarks, and performance", async () => {
		const [catalogue, benchmarks, performance] = await Promise.all([
			app.request("https://phaseo.app/api/_web/models", {}, env),
			app.request("https://phaseo.app/api/_web/models/openai%2Fgpt-test/benchmarks", {}, env),
			app.request("https://phaseo.app/api/_web/models/openai%2Fgpt-test/performance", {}, env),
		]);

		expect(catalogue.status).toBe(200);
		expect(catalogue.headers.get("cache-control")).toBe("public, max-age=900, s-maxage=900, stale-while-revalidate=1800");
		expect(catalogue.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=900, stale-while-revalidate=1800");
		expect(benchmarks.status).toBe(200);
		expect(benchmarks.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=86400, stale-while-revalidate=604800");
		await expect(benchmarks.json()).resolves.toMatchObject({ highlights: [{ benchmarkId: "mmlu", score: 85, scoreDisplay: "85%", rank: 2 }] });
		expect(performance.status).toBe(200);
		expect(performance.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=900, stale-while-revalidate=900");
	});

	it("never exposes a synthetic unknown provider in performance data", async () => {
		const response = await app.request(
			"https://phaseo.app/api/_web/models/poolside%2Flaguna-s-2.1/performance",
			{},
			env,
		);
		const payload = await response.json() as any;

		expect(response.status).toBe(200);
		expect(payload.performance.provider_uptime_24h).toEqual([
			expect.objectContaining({ provider: "poolside" }),
		]);
		expect(payload.performance.provider_daily_7d).toEqual([
			expect.objectContaining({ provider: "poolside" }),
		]);
		expect(payload.metrics.providerPerformance).toEqual([
			expect.objectContaining({ provider: "poolside", providerColor: "#12AB78" }),
		]);
		expect(payload.metrics.providerDaily7d).toEqual([
				expect.objectContaining({
					provider: "poolside",
					providerColor: "#12AB78",
				cachedInputPct: 62.5,
				cachedInputTokens: 625,
				effectiveInputTokens: 1000,
				cacheTelemetryRequests: 11,
			}),
		]);
		expect(payload.metrics.providerPercentileDaily7d).toHaveLength(5);
		expect(payload.metrics.providerPercentileDaily7d).toContainEqual(
			expect.objectContaining({
				provider: "poolside",
				providerColor: "#12AB78",
				percentile: 95,
				avgLatencyMs: 900,
				avgGenerationMs: 1200,
				avgThroughput: 13.4,
				cachedInputPct: 88.5,
			}),
		);
		expect(JSON.stringify(payload)).not.toContain('"unknown"');
	});

	it("does not expose single-provider percentiles when seven-day traffic has multiple providers", async () => {
		vi.mocked(getModelPerformanceBundle).mockResolvedValueOnce({ performance: { last_24h: { total_requests: 12, successful_requests: 11 }, hourly_24h: [], provider_uptime_24h: [{ provider: "poolside", provider_name: "Poolside", requests: 11 }], provider_daily_7d: [{ day: "2026-07-23", provider: "poolside", requests: 11 }, { day: "2026-07-20", provider: "openai", requests: 4 }] }, health: [], cachedInput: {}, percentileSeries: [] });

		const response = await app.request(
			"https://phaseo.app/api/_web/models/test%2Fmodel/performance",
			{},
			env,
		);
		const payload = await response.json() as any;

		expect(response.status).toBe(200);
		expect(payload.metrics.providerPercentileDaily7d).toEqual([]);
	});

	it("does not replace a filtered cohort with all-traffic provider health", async () => {
		vi.mocked(getModelPerformanceBundle).mockResolvedValueOnce({ performance: { last_24h: { total_requests: 1, successful_requests: 1 }, hourly_24h: [], provider_uptime_24h: [{ provider: "filtered", requests: 1 }], provider_daily_7d: [] }, health: [{ provider_id: "all-traffic", health_requests: 100 }], cachedInput: {}, percentileSeries: [] });

		const response = await app.request(
			"https://phaseo.app/api/_web/models/test%2Fmodel/performance?stream=stream",
			{},
			env,
		);
		const payload = await response.json() as any;

		expect(response.status).toBe(200);
		expect(payload.performance.provider_uptime_24h).toEqual([
			expect.objectContaining({ provider: "filtered" }),
		]);
		expect(payload.performance.provider_uptime_24h).not.toContainEqual(
			expect.objectContaining({ provider: "all-traffic" }),
		);
	});

	it("returns compact gateway availability without calling the legacy RPC", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (!url.includes("get_v2_model_availability")) return new Response(JSON.stringify([]), { status: 200 });
			return new Response(JSON.stringify({ is_gateway_active: true, active_provider_count: 1 }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request("https://phaseo.app/api/_web/models/openai%2Fgpt-test/availability", {}, env);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			availability: { isGatewayActive: true, activeProviderCount: 1 },
		});
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("get_v2_model_availability"))).toBe(false);
	});

	it("uses standard-tier availability without dropping alternate pricing plans", async () => {
		const response = await app.request(
			"https://phaseo.app/api/_web/models/openai%2Fgpt-5.6-sol/pricing",
			{},
			env,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			providers: [{
				provider: { routing_status: "active" },
				provider_models: [{ is_active_gateway: true }],
				pricing_rules: [
					{ id: "standard-price", pricing_plan: "standard" },
					{ id: "batch-price", pricing_plan: "batch" },
				],
			}],
		});
		expect(loadModelPricingSources).toHaveBeenCalled();
	});

	it("returns the overview shape used by the model page", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_v2_model_overview")) return new Response(JSON.stringify({
				model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai",
				organisation_name: "OpenAI", organisation_country_code: "US", model_details: [], model_links: [],
			}), { status: 200 });
			if (url.includes("get_v2_model_identity")) return new Response(JSON.stringify({ model_slug: "openai/gpt-test", license: "MIT", license_url: null, limits: { context: 128000 } }), { status: 200 });
			if (url.includes("get_v2_model_aliases")) return new Response(JSON.stringify([]), { status: 200 });
			if (url.includes("get_v2_model_variants")) return new Response(JSON.stringify([
				{ model_id: "openai/gpt-test", name: "GPT Test", variant_kind: "standard" },
				{ model_id: "openai/gpt-test:free", name: "GPT Test (Free)", variant_kind: "free" },
			]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models/openai%2Fgpt-test",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-tag")).toContain("web-api-model-details");
		await expect(response.json()).resolves.toMatchObject({
			model: {
				model_id: "openai/gpt-test",
				license: "MIT",
				model_details: [
					{ detail_name: "license", detail_value: "MIT" },
				],
				variants: [
					{ model_id: "openai/gpt-test", name: "GPT Test", variant_kind: "standard" },
					{ model_id: "openai/gpt-test:free", name: "GPT Test (Free)", variant_kind: "free" },
				],
			},
		});
	});

	it("returns public model app usage from the rollup RPC", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_v2_model_apps")) return new Response(JSON.stringify([{ app_id: "app-1", title: "Example", image_url: "https://example.com/app.png", url: "https://example.com", last_seen: "2026-07-17T00:00:00Z", requests: "4", success_requests: "3", total_tokens: "100" }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));
		const response = await app.request("https://phaseo.app/api/_web/models/openai%2Fgpt-test/apps", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=900, stale-while-revalidate=3600");
		await expect(response.json()).resolves.toEqual({ apps: [{ appId: "app-1", title: "Example", imageUrl: "https://example.com/app.png", url: "https://example.com", lastSeen: "2026-07-17T00:00:00Z", totalRequests: 4, successfulRequests: 3, totalTokens: 100 }], source: "v2" });
	});

	it("returns parity-shaped timeline and subscription-plan sections", async () => {
		const [timeline, subscriptions] = await Promise.all([
			app.request("https://phaseo.app/api/_web/models/openai%2Fgpt-test/timeline", {}, env),
			app.request("https://phaseo.app/api/_web/models/openai%2Fgpt-test/subscription-plans", {}, env),
		]);

		expect(timeline.status).toBe(200);
		expect(timeline.headers.get("cache-tag")).toContain("web-api-model-timelines");
		expect(await timeline.json()).toMatchObject({
			events: expect.arrayContaining([
				expect.objectContaining({ eventType: "FutureModel", modelId: "openai/gpt-next" }),
				expect.objectContaining({ eventType: "ModelEvent", eventName: "Released" }),
			]),
		});
		expect(subscriptions.status).toBe(200);
		expect(subscriptions.headers.get("cache-tag")).toContain("web-api-model-subscriptions");
		await expect(subscriptions.json()).resolves.toMatchObject({
			subscription_plans: [{
				plan_id: "pro",
				prices: [{ price: 20, frequency: "month" }],
				model_info: { rate_limit: { rpm: 10 } },
			}],
		});
	});

	it("resolves aliases to a validated public model notice", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("v2_model_aliases")) {
				return new Response(JSON.stringify([{
					model_slug: "openai/gpt-test",
				}]), { status: 200 });
			}
			if (url.includes("v2_model_page_notices")) {
				return new Response(JSON.stringify([{
					api_model_id: "openai/gpt-test",
					tone: "warning",
					markdown: "This model is changing.",
				}]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models/gpt-test-alias/notice",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=3600, stale-while-revalidate=86400",
		);
		expect(response.headers.get("cache-tag")).toContain("web-api-model-notices");
		await expect(response.json()).resolves.toEqual({
			notice: {
				apiModelId: "openai/gpt-test",
				tone: "warning",
				markdown: "This model is changing.",
			},
		});
	});

	it("computes realtime model medians across aliases with a short cache", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("data_api_provider_models")) {
				return new Response(JSON.stringify([{
					model_id: "openai/gpt-test",
					api_model_id: "gpt-test",
				}]), { status: 200 });
			}
			if (url.includes("gateway_requests")) {
				return new Response(JSON.stringify([
					{ latency_ms: 100, throughput: 20, generation_ms: null, usage: null },
					{ latency_ms: 300, throughput: null, generation_ms: 2_000, usage: { output_tokens: 80 } },
				]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models/openai%2Fgpt-test/realtime?minutes=15",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=300, stale-while-revalidate=300",
		);
		await expect(response.json()).resolves.toEqual({ stats: {
			requestsInWindow: 2,
			latencyP50Ms: 200,
			throughputP50TokPerSec: 30,
		} });
	});

	it("maps token trajectory repository output behind its independent cache", async () => {
		vi.mocked(getModelTokenTrajectory).mockResolvedValueOnce({
			release_date: "2026-01-01",
			deprecation_date: "2026-01-03T00:00:00Z",
			points: [{ date: "2026-01-03", tokens: 25, cumulativeTokens: 100, daysSinceRelease: 2 }],
			token_milestones: [{ threshold: 100, reachedOn: "2026-01-03", daysSinceRelease: 2 }],
			successor_milestones: [],
		});
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_model_token_trajectory")) {
				return new Response(JSON.stringify([{
					release_date: "2026-01-01",
					deprecation_date: "2026-01-03T00:00:00Z",
					points: [{ date: "2026-01-03", tokens: 25, cumulativeTokens: 100, daysSinceRelease: 2 }],
					token_milestones: [{ threshold: 100, reachedOn: "2026-01-03", daysSinceRelease: 2 }],
					successor_milestones: [],
				}]), { status: 200 });
			}
			return new Response(JSON.stringify([{ model_id: "openai/gpt-test" }]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/models/openai%2Fgpt-test/token-trajectory",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=3600, stale-while-revalidate=21600",
		);
		await expect(response.json()).resolves.toMatchObject({ trajectory: {
			releaseDate: "2026-01-01",
			deprecationDaysSinceRelease: 2,
			tokenMilestones: [{ threshold: 100 }],
		} });
	});

	it("keeps provider routing health on its exact route and volatile cache", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
			{ provider_id: "openai", breaker_state: "open", is_deranked: false, open_until_ms: Date.now() + 60_000 },
			{ provider_id: "openai", breaker_state: "half_open", is_deranked: false, open_until_ms: null },
		]), { status: 200 })));

		const response = await app.request(
			"https://phaseo.app/api/_web/models/provider-routing-health?provider_ids=openai",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-tag")).toBe("web-api-provider-routing-health");
		await expect(response.json()).resolves.toEqual({ providers: { openai: {
			providerId: "openai",
			deranked: true,
			recovering: false,
			openCount: 1,
			halfOpenCount: 1,
			checkedPairs: 2,
		} } });
	});
});
