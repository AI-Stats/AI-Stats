import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
	getRankingSummary: vi.fn(), listContextLengths: vi.fn(), listFastestModels: vi.fn(), listGeography: vi.fn(),
	listIntelligenceIndex: vi.fn(), listMarketShare: vi.fn(), listMarketShareTimeseries: vi.fn(), listModelMetadata: vi.fn(),
	listModelPerformance: vi.fn(), listModelRankings: vi.fn(), listModalityTimeseries: vi.fn(), listMultimodalBreakdown: vi.fn(),
	listOrganisationLogoIds: vi.fn(), listProviderMetadata: vi.fn(), listToolCalls: vi.fn(), listTrendingModels: vi.fn(),
	listUniqueUsers: vi.fn(), listUsageTimeseries: vi.fn(), loadRankingBenchmarks: vi.fn(),
}));
const appsRepository = vi.hoisted(() => ({ listTopApps: vi.fn() }));
vi.mock("@/repositories/rankings", () => repository);
vi.mock("@/repositories/apps", async (importOriginal) => ({ ...await importOriginal<typeof import("@/repositories/apps")>(), listTopApps: appsRepository.listTopApps }));

import app from "@/index";
const env = { ENV: "development" as const };

beforeEach(() => {
	vi.clearAllMocks();
	for (const mock of Object.values(repository)) mock.mockResolvedValue([]);
	appsRepository.listTopApps.mockResolvedValue([]);
});

describe("public rankings routes", () => {
	it("passes URL parameters to the Drizzle repository and applies volatile caching", async () => {
		repository.listUsageTimeseries.mockResolvedValue([{ model_id: "openai/gpt-test", tokens: 10 }]);
		const response = await app.request("https://phaseo.app/api/_web/rankings/timeseries?time_range=month&bucket_size=day&top_n=4", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=900, stale-while-revalidate=900");
		expect(repository.listUsageTimeseries).toHaveBeenCalledWith(env, "month", "day", 4);
		await expect(response.json()).resolves.toEqual({ data: [{ model_id: "openai/gpt-test", tokens: 10 }] });
	});

	it("returns a compact cached benchmark leaderboard with model metadata", async () => {
		repository.loadRankingBenchmarks.mockResolvedValue({
			benchmarks: [{ benchmark_id: "aa-intelligence-index-v4", name: "Intelligence Index", category: "general", ascending_order: false, benchmark_type: "percentage", total_models: 2 }],
			scores: [{ benchmark_id: "aa-intelligence-index-v4", model_slug: "openai/gpt-test", score_numeric: 58, rank: 2 }, { benchmark_id: "aa-intelligence-index-v4", model_slug: "anthropic/claude-test", score_numeric: 61, rank: 1 }],
			models: [{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", lab_name: "OpenAI" }, { model_slug: "anthropic/claude-test", name: "Claude Test", lab_slug: "anthropic", lab_name: "Anthropic" }],
		});
		const response = await app.request("https://phaseo.app/api/_web/rankings/benchmarks", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400");
		await expect(response.json()).resolves.toMatchObject({ benchmarks: [{ entries: [{ model_id: "anthropic/claude-test", rank: 1 }, { model_id: "openai/gpt-test", rank: 2 }] }] });
	});

	it("serves the observed context-length distribution", async () => {
		repository.listContextLengths.mockResolvedValue([{ bucket_key: "under_4k", requests: 240 }]);
		const response = await app.request("https://phaseo.app/api/_web/rankings/context-lengths?days=45", {}, env);
		expect(response.status).toBe(200);
		expect(repository.listContextLengths).toHaveBeenCalledWith(env, 45);
		await expect(response.json()).resolves.toMatchObject({ days: 45, data: [{ bucket_key: "under_4k", requests: 240 }] });
	});

	it("serves Fastest Models from its dedicated Drizzle query", async () => {
		repository.listFastestModels.mockResolvedValue([{ model_id: "openai/gpt-test", median_throughput: 42 }]);
		const response = await app.request("https://phaseo.app/api/_web/rankings/fastest-models?days=30&limit=20", {}, env);
		expect(response.status).toBe(200);
		expect(repository.listFastestModels).toHaveBeenCalledWith(env, 30, 20);
	});

	it("serves the Intelligence Index from its dedicated Drizzle query", async () => {
		repository.listIntelligenceIndex.mockResolvedValue([{ benchmark_id: "aa-intelligence-index-v4", benchmark_name: "Intelligence Index", model_id: "openai/gpt-test", model_name: "GPT Test", score: 60, rank: 1, total_models: 261 }]);
		const response = await app.request("https://phaseo.app/api/_web/rankings/intelligence-index?limit=20", {}, env);
		expect(response.status).toBe(200);
		expect(repository.listIntelligenceIndex).toHaveBeenCalledWith(env, 20);
		await expect(response.json()).resolves.toMatchObject({ benchmark: { total_models: 261, entries: [{ model_id: "openai/gpt-test", rank: 1 }] } });
	});

	it("requests exact country rows for the selected period", async () => {
		repository.listGeography.mockResolvedValue([{ country_code: "GB", requests: 75, workspace_count: 1 }]);
		const response = await app.request("https://phaseo.app/api/_web/rankings/geography?days=30", {}, env);
		expect(response.status).toBe(200);
		const [, from, to] = repository.listGeography.mock.calls[0];
		expect(to.getTime() - from.getTime()).toBe(30 * 86_400_000);
		await expect(response.json()).resolves.toMatchObject({ data: [{ country_code: "GB", requests: 75 }] });
	});
});
