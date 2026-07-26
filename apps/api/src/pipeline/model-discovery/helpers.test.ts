import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
	assertSafeDiscoverySnapshot,
	buildDiscordMessage,
	extractDiscoveredModels,
	extractProviderApiModelSnapshot,
	fetchProviderModels,
	formatPricingSample,
	resolveProviderModelsEndpoint,
} from "./helpers";
import { installFetchMock, jsonResponse } from "../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";

const POOLSIDE_DISCOVERY_PROVIDER = {
	providerId: "poolside",
	providerName: "Poolside",
	modelsEndpoint: "https://inference.poolside.ai/v1/models",
	pathPrefix: "/v1",
	baseUrlEnv: ["POOLSIDE_BASE_URL"],
	apiKeyEnv: ["POOLSIDE_API_KEY"],
} as const;

const GOOGLE_VERTEX_DISCOVERY_PROVIDER = {
	providerId: "google-vertex",
	providerName: "Google Vertex",
	modelsEndpoint:
		"https://aiplatform.googleapis.com/v1beta1/publishers/google/models?listAllVersions=true&pageSize=300",
	apiKeyEnv: ["GOOGLE_VERTEX_ACCESS_TOKEN", "GOOGLE_VERTEX_API_KEY"],
	authStyle: "google_vertex",
} as const;

afterEach(() => {
	teardownTestRuntime();
});

afterAll(() => {
	teardownTestRuntime();
});

describe("resolveProviderModelsEndpoint", () => {
	it("interpolates encoded endpoint parameters from Worker bindings", () => {
		setupRuntimeFromEnv({
			CLOUDFLARE_ACCOUNT_ID: "account/id",
		} as any);

		expect(resolveProviderModelsEndpoint({
			providerId: "cloudflare",
			providerName: "Cloudflare Workers AI",
			modelsEndpoint: "https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/models/search?format=openrouter",
			modelsEndpointParams: { accountId: ["CLOUDFLARE_ACCOUNT_ID"] },
		})).toBe(
			"https://api.cloudflare.com/client/v4/accounts/account%2Fid/ai/models/search?format=openrouter",
		);
	});
	it("appends the poolside openai prefix when the base url override is a root domain", () => {
		setupRuntimeFromEnv({
			POOLSIDE_BASE_URL: "https://poolside.example",
		} as any);

		expect(resolveProviderModelsEndpoint(POOLSIDE_DISCOVERY_PROVIDER)).toBe(
			"https://poolside.example/v1/models",
		);
	});

	it("appends only /models when the poolside base url override already includes /v1", () => {
		setupRuntimeFromEnv({
			POOLSIDE_BASE_URL: "https://poolside.example/v1",
		} as any);

		expect(resolveProviderModelsEndpoint(POOLSIDE_DISCOVERY_PROVIDER)).toBe(
			"https://poolside.example/v1/models",
		);
	});
});

describe("fetchProviderModels", () => {
	it("uses DigitalOcean model_id instead of the internal catalog UUID", async () => {
		const fetchMock = installFetchMock([{
			match: (url) => url.includes("/v2/gen-ai/models/catalog"),
			response: jsonResponse({
				data: [{ id: "00000000-0000-0000-0000-000000000029", model_id: "deepseek-v3.2" }],
			}),
		}]);

		try {
			const models = await fetchProviderModels({
				providerId: "digitalocean",
				providerName: "DigitalOcean",
				modelsEndpoint: "https://api.digitalocean.com/v2/gen-ai/models/catalog?limit=200",
				authStyle: "none",
			});
			expect(models.map((model) => model.id)).toEqual(["deepseek-v3.2"]);
		} finally {
			fetchMock.restore();
		}
	});

	it("uses the resolved poolside models endpoint and extracts standard openai model ids", async () => {
		setupRuntimeFromEnv({
			POOLSIDE_API_KEY: "test-poolside-key",
			POOLSIDE_BASE_URL: "https://poolside.example/v1",
		} as any);

		const fetchMock = installFetchMock([
			{
				match: (url) => url === "https://poolside.example/v1/models",
				response: jsonResponse({
					data: [
						{ id: "poolside/laguna-m.1", created: 123 },
						{ id: "poolside/laguna-xs.2", created: 456 },
					],
				}),
			},
		]);

		try {
			const models = await fetchProviderModels(POOLSIDE_DISCOVERY_PROVIDER, "test-poolside-key");

			expect(models.map((model) => model.id)).toEqual([
				"poolside/laguna-m.1",
				"poolside/laguna-xs.2",
			]);
			expect(fetchMock.calls).toHaveLength(1);
			expect(fetchMock.calls[0]?.headers.Authorization).toBe("Bearer test-poolside-key");
		} finally {
			fetchMock.restore();
		}
	});

	it("throws when the provider returns an error envelope in a successful HTTP response", async () => {
		setupRuntimeFromEnv({
			POOLSIDE_API_KEY: "test-poolside-key",
			POOLSIDE_BASE_URL: "https://poolside.example/v1",
		} as any);

		const fetchMock = installFetchMock([
			{
				match: (url) => url === "https://poolside.example/v1/models",
				response: jsonResponse({
					error: {
						message: "upstream provider reported a failure",
					},
				}),
			},
		]);

		try {
			await expect(fetchProviderModels(POOLSIDE_DISCOVERY_PROVIDER, "test-poolside-key")).rejects.toThrow(
				"upstream provider reported a failure",
			);
		} finally {
			fetchMock.restore();
		}
	});

	it("merges google and anthropic publisher models for google-vertex discovery", async () => {
		setupRuntimeFromEnv({
			GOOGLE_VERTEX_ACCESS_TOKEN: "test-vertex-token",
		} as any);

		const fetchMock = installFetchMock([
			{
				match: (url) =>
					url ===
					"https://aiplatform.googleapis.com/v1beta1/publishers/google/models?listAllVersions=true&pageSize=300",
				response: jsonResponse({
					publisherModels: [
						{
							name: "publishers/google/models/gemini-3.5-flash",
							versionId: "default",
						},
					],
				}),
			},
			{
				match: (url) =>
					url ===
					"https://aiplatform.googleapis.com/v1beta1/publishers/anthropic/models?listAllVersions=true&pageSize=300",
				response: jsonResponse({
					publisherModels: [
						{
							name: "publishers/anthropic/models/claude-sonnet-4-6",
							versionId: "20260219",
						},
					],
				}),
			},
		]);

		try {
			const models = await fetchProviderModels(GOOGLE_VERTEX_DISCOVERY_PROVIDER, "test-vertex-token");

			expect(models.map((model) => model.id)).toEqual([
				"claude-sonnet-4-6@20260219",
				"gemini-3.5-flash",
			]);
			expect(fetchMock.calls).toHaveLength(2);
			expect(fetchMock.calls[0]?.headers.Authorization).toBe("Bearer test-vertex-token");
			expect(fetchMock.calls[1]?.headers.Authorization).toBe("Bearer test-vertex-token");
		} finally {
			fetchMock.restore();
		}
	});
});

describe("extractProviderApiModelSnapshot", () => {
	it("retains media pricing alongside normalized token rates", () => {
		const snapshot = extractProviderApiModelSnapshot(
			"deepinfra",
			{
				metadata: {
					pricing: {
						input_tokens: 0.2,
						output_tokens: 1,
						per_image_unit: 0.04,
					},
				},
			},
			{ metadata: { pricing: { input_tokens: 0.2, output_tokens: 1, per_image_unit: 0.04 } } },
		);

		expect(snapshot.pricingDetails).toEqual({
			normalized: {
				currency: "USD",
				unit: "per_1m_tokens",
				meters: { input_text_tokens: 0.2, output_text_tokens: 1 },
			},
			sourcePricing: { metadata: { pricing: { input_tokens: 0.2, output_tokens: 1, per_image_unit: 0.04 } } },
		});
	});
});

describe("extractDiscoveredModels", () => {
	it("extracts model pricing from top-level array responses", () => {
		const models = extractDiscoveredModels("together", [
			{
				id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
				pricing: { input: 0.88, output: 0.88 },
			},
		]);

		expect(models).toHaveLength(1);
		expect(models[0]).toMatchObject({
			id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
			pricingDetails: { pricing: { input: 0.88, output: 0.88 } },
		});
	});
});

describe("buildDiscordMessage", () => {
	it("includes pricing-only changes", () => {
		setupRuntimeFromEnv({} as any);
		expect(buildDiscordMessage({
			modelChanges: [],
			pricing: { updatesDetected: 1, providerChanges: [{ providerId: "crofai", updates: 1, samples: ["glm-5.2 | price changed"] }] },
			providerApiPricing: { updatesDetected: 1, providerChanges: [{ providerId: "deepinfra", updates: 1, samples: ["model | price changed"] }] },
			pricingTable: { updatesDetected: 0, providerChanges: [], errors: [] },
			configuredModelCoverage: { updatesDetected: 0, providerChanges: [] },
		} as any)).toContain("Pricing monitor detected 1 updated rule");
	});

	it("includes pricing source failures", () => {
		setupRuntimeFromEnv({} as any);
		expect(buildDiscordMessage({
			modelChanges: [],
			pricing: { updatesDetected: 0, providerChanges: [] },
			providerApiPricing: { updatesDetected: 0, providerChanges: [] },
			pricingTable: {
				updatesDetected: 0,
				providerChanges: [],
				errors: ["Alibaba pricing source returned no prices"],
			},
			configuredModelCoverage: { updatesDetected: 0, providerChanges: [] },
		} as any)).toContain("Alibaba pricing source returned no prices");
	});

	it("prefers an explicit catalog endpoint over the gateway base URL", () => {
		expect(resolveProviderModelsEndpoint({
			providerId: "catalog",
			providerName: "Catalog",
			modelsEndpoint: "https://catalog.example/models.json",
			baseUrl: "https://gateway.example/v1",
			authStyle: "none",
		})).toBe("https://catalog.example/models.json");
	});
});

describe("W&B provider catalog extraction", () => {
	it("extracts models from the provider-owned nested catalog", () => {
		expect(extractDiscoveredModels("weights-and-biases", {
			coreweave: {
				models: {
					"openai/gpt-oss-120b": {
						id: "openai/gpt-oss-120b",
						name: "OpenAI: gpt-oss-120b",
						cost: { input: 0.03, output: 0.17, cache_read: 0.03 },
					},
				},
			},
		})).toEqual([expect.objectContaining({ id: "openai/gpt-oss-120b" })]);
	});
});

describe("pricing samples", () => {
	it("formats the model from the v2 legacy pricing projection", () => {
		expect(formatPricingSample({
			rule_id: "rule-1",
			provider_id: "openai",
			api_model_id: "openai/gpt-5.4",
			capability_id: "text.generate",
			pricing_plan: "standard",
			meter: "input_text_tokens",
			price_per_unit: 2.5,
			currency: "USD",
			effective_from: null,
			effective_to: null,
			updated_at: "2026-07-26T00:00:00Z",
		})).toContain("openai/gpt-5.4");
	});
});

describe("assertSafeDiscoverySnapshot", () => {
	it("rejects empty and catastrophic provider snapshots", () => {
		expect(() => assertSafeDiscoverySnapshot("provider", ["a"], [])).toThrow("returned zero models");
		expect(() => assertSafeDiscoverySnapshot("provider", ["a", "b", "c", "d", "e", "f", "g", "h"], ["a"])).toThrow(
			"refusing a destructive snapshot",
		);
	});

	it("accepts normal provider churn", () => {
		expect(() => assertSafeDiscoverySnapshot("provider", ["a", "b", "c", "d", "e"], ["a", "b", "c", "f"])).not.toThrow();
	});
});
