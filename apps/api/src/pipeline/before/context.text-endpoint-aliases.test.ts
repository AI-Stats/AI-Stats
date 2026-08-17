import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
	const cache = {
		get: vi.fn(async () => null),
		put: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
	};

	const fetchRequestContext = vi.fn(async (args: { endpoint: string }) => {
		const providers =
			args.endpoint === "text.generate"
				? [
					{
						provider_id: "mistral",
						api_model_id: "mistral/devstral-2",
						pricing_key: "mistral:mistral/devstral-2",
						provider_status: "active",
						provider_routing_status: "active",
						model_status: "active",
						capability_status: "active",
						provider_model_slug: "devstral-2512",
						input_modalities: ["text"],
						output_modalities: ["text"],
						supports_endpoint: true,
						base_weight: 1,
						byok_meta: [],
						capability_params: {},
						max_input_tokens: 262144,
						max_output_tokens: 16384,
					},
				]
				: [];

		return {
			workspace_id: "ws_text_alias",
			resolved_model: "mistral/devstral-2",
			key_ok: { ok: true, reason: null },
			key_limit_ok: { ok: true, reason: null },
			credit_ok: { ok: true, reason: null },
			providers,
			pricing: {},
		};
	});

	return {
		cache,
		fetchRequestContext,
	};
});

const loadPriceCardMock = vi.hoisted(() => vi.fn());

vi.mock("@/runtime/env", () => ({
	getCache: () => runtime.cache as unknown as KVNamespace,
}));

vi.mock("@/repositories/gateway-context", () => ({
	fetchRequestContext: (args: { endpoint: string }) => runtime.fetchRequestContext(args),
	loadWorkspaceEnrichment: async (_workspaceId: string, providerIds: string[]) => ({
		settings: { routing_mode: "balanced", byok_fallback_enabled: true, beta_channel_enabled: false, alpha_channel_enabled: false, cache_aware_routing_enabled: true },
		workspace: { billing_mode: "wallet" },
		providers: providerIds.map((provider_slug) => ({ provider_slug, status: "active", routing_enabled: true, provider_family_slug: null, offer_scope: null, offer_label: null, metadata: {} })),
	}),
	findWallet: async () => null, listByokKeys: async () => [], listRoutes: async () => [], listCapabilities: async () => [], listModels: async () => [], listProviders: async () => [],
}));

vi.mock("@pipeline/pricing", () => ({
	loadPriceCard: (...args: any[]) => loadPriceCardMock(...args),
}));

describe("fetchGatewayContext text endpoint aliases", () => {
	beforeEach(() => {
		runtime.cache.get.mockClear();
		runtime.cache.put.mockClear();
		runtime.cache.delete.mockClear();
		runtime.fetchRequestContext.mockClear();
		loadPriceCardMock.mockReset();
		loadPriceCardMock.mockResolvedValue({
			provider: "mistral",
			model: "mistral/devstral-2",
			endpoint: "text.generate",
			effective_from: null,
			effective_to: null,
			currency: "USD",
			version: "1",
			rules: [],
		});
		vi.resetModules();
	});

	it("falls back from /responses surface routing to text.generate providers", async () => {
		const { fetchGatewayContext } = await import("./context");
		const context = await fetchGatewayContext({
			workspaceId: "ws_text_alias",
			model: "mistral/devstral-2",
			endpoint: "responses",
			apiKeyId: "key_text_alias",
			disableCache: true,
		});

		expect(context.providers).toHaveLength(1);
		expect(context.providers[0]).toEqual(
			expect.objectContaining({
				providerId: "mistral",
				apiModelId: "mistral/devstral-2",
				providerModelSlug: "devstral-2512",
				inputModalities: ["text"],
				outputModalities: ["text"],
				supportsEndpoint: true,
			}),
		);
		expect(
			runtime.fetchRequestContext.mock.calls.map(([args]) => args.endpoint),
		).toContain("text.generate");
		expect(loadPriceCardMock).toHaveBeenCalledWith(
			"mistral",
			"mistral/devstral-2",
			expect.any(String),
		);
	});

	it("merges text.generate providers when the first /responses context is only partial", async () => {
		runtime.fetchRequestContext.mockImplementation(async (args: { endpoint: string }) => {
			const providers =
				args.endpoint === "responses"
					? [
						{
							provider_id: "minimax",
							api_model_id: "minimax/minimax-m3",
							pricing_key: "minimax",
							provider_status: "active",
							provider_routing_status: "active",
							model_status: "active",
							capability_status: "active",
							provider_model_slug: "MiniMax-M3",
							input_modalities: ["text", "image", "video"],
							output_modalities: ["text"],
							supports_endpoint: true,
							base_weight: 1,
							byok_meta: [],
							capability_params: {},
							max_input_tokens: null,
							max_output_tokens: null,
						},
					]
					: args.endpoint === "text.generate"
						? [
							{
								provider_id: "novita",
								api_model_id: "minimax/minimax-m3",
								pricing_key: "novita",
								provider_status: "active",
								provider_routing_status: "active",
								model_status: "active",
								capability_status: "active",
								provider_model_slug: "minimax/minimax-m3",
								input_modalities: ["text", "image", "video"],
								output_modalities: ["text"],
								supports_endpoint: true,
								base_weight: 1,
								byok_meta: [],
								capability_params: {},
								max_input_tokens: null,
								max_output_tokens: null,
							},
							{
								provider_id: "venice",
								api_model_id: "minimax/minimax-m3",
								pricing_key: "venice",
								provider_status: "active",
								provider_routing_status: "active",
								model_status: "active",
								capability_status: "active",
								provider_model_slug: "minimax-m3",
								input_modalities: ["text", "image"],
								output_modalities: ["text"],
								supports_endpoint: true,
								base_weight: 1,
								byok_meta: [],
								capability_params: {},
								max_input_tokens: null,
								max_output_tokens: null,
							},
						]
						: [];

			return {
				workspace_id: "ws_text_alias",
				resolved_model: "minimax/minimax-m3",
				key_ok: { ok: true, reason: null },
				key_limit_ok: { ok: true, reason: null },
				credit_ok: { ok: true, reason: null },
				providers,
				pricing: {},
			};
		});

		const { fetchGatewayContext } = await import("./context");
		const context = await fetchGatewayContext({
			workspaceId: "ws_text_alias",
			model: "minimax/minimax-m3",
			endpoint: "responses",
			apiKeyId: "key_text_alias",
			disableCache: true,
		});

		expect(context.providers.map((provider) => provider.providerId).sort()).toEqual([
			"minimax",
			"novita",
			"venice",
		]);
		expect(
			runtime.fetchRequestContext.mock.calls.map(([args]) => args.endpoint),
		).toContain("text.generate");
	});
});
