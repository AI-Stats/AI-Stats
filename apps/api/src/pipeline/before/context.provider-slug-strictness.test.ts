import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
	const cache = {
		get: vi.fn(async () => null),
		put: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
	};

	const fetchRequestContext = vi.fn(async (args: { model: string }) => (
			{
				workspace_id: "ws_poolside",
				resolved_model: args.model,
				key_ok: { ok: true, reason: null },
				key_limit_ok: { ok: true, reason: null },
				credit_ok: { ok: true, reason: null },
				providers: [],
				pricing: {},
			}
	));

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
	fetchRequestContext: (args: { model: string }) => runtime.fetchRequestContext(args),
	listRoutes: async () => [],
	loadWorkspaceEnrichment: async () => ({ settings: { routing_mode: "balanced", byok_fallback_enabled: true, beta_channel_enabled: false, alpha_channel_enabled: false, cache_aware_routing_enabled: true }, workspace: { billing_mode: "wallet" }, providers: [] }),
	findWallet: async () => null, listByokKeys: async () => [], listCapabilities: async () => [], listModels: async () => [], listProviders: async () => [],
}));

vi.mock("@pipeline/pricing", () => ({
	loadPriceCard: (...args: any[]) => loadPriceCardMock(...args),
}));

describe("fetchGatewayContext provider-scoped strictness", () => {
	beforeEach(() => {
		runtime.cache.get.mockClear();
		runtime.cache.put.mockClear();
		runtime.cache.delete.mockClear();
		runtime.fetchRequestContext.mockClear();
		loadPriceCardMock.mockReset();
		vi.resetModules();
	});

	it("does not remap a canonical model id to a :free api_model_id unless it is explicitly configured", async () => {
		const { fetchGatewayContext } = await import("./context");
		const context = await fetchGatewayContext({
			workspaceId: "ws_poolside",
			model: "poolside/laguna-m.1",
			endpoint: "responses",
			apiKeyId: "key_poolside",
			disableCache: true,
		});

		expect(context.resolvedModel).toBe("poolside/laguna-m.1");
		expect(context.providers).toEqual([]);
		expect(runtime.fetchRequestContext.mock.calls.map(([args]) => args.model)).toEqual([
			"poolside/laguna-m.1",
			"poolside/laguna-m.1",
		]);
	});
});
