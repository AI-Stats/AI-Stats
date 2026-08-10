import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";
const env = { ENV: "development" as const, SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" };
afterEach(() => vi.unstubAllGlobals());

describe("public rankings routes", () => {
	it("passes URL parameters to the aggregate RPC and applies volatile caching", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ model_id: "openai/gpt-test", tokens: 10 }]), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		const response = await app.request("https://phaseo.app/api/_web/rankings/timeseries?time_range=month&bucket_size=day&top_n=4", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=900, stale-while-revalidate=900");
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("get_public_usage_timeseries");
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"p_time_range":"month"');
		await expect(response.json()).resolves.toEqual({ data: [{ model_id: "openai/gpt-test", tokens: 10 }] });
	});

	it("returns a compact cached benchmark leaderboard with model metadata", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.includes("v2_benchmarks")) {
				return new Response(JSON.stringify([{
					benchmark_id: "aa-intelligence-index-v4",
					name: "Artificial Analysis Intelligence Index v4.1",
					category: "general",
					ascending_order: false,
					benchmark_type: "percentage",
					total_models: 2,
				}]), { status: 200 });
			}
			if (url.includes("v2_benchmark_results")) {
				return new Response(JSON.stringify([
					{ benchmark_id: "aa-intelligence-index-v4", model_slug: "openai/gpt-test", score_numeric: 58, rank: 2 },
					{ benchmark_id: "aa-intelligence-index-v4", model_slug: "anthropic/claude-test", score_numeric: 61, rank: 1 },
				]), { status: 200 });
			}
			if (url.includes("v2_models")) {
				return new Response(JSON.stringify([
					{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", lab: { name: "OpenAI" } },
					{ model_slug: "anthropic/claude-test", name: "Claude Test", lab_slug: "anthropic", lab: { name: "Anthropic" } },
				]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request("https://phaseo.app/api/_web/rankings/benchmarks", {}, env);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400");
		await expect(response.json()).resolves.toMatchObject({
			benchmarks: [{
				benchmark_id: "aa-intelligence-index-v4",
				entries: [
					{ model_id: "anthropic/claude-test", model_name: "Claude Test", rank: 1 },
					{ model_id: "openai/gpt-test", model_name: "GPT Test", rank: 2 },
				],
			}],
		});
	});

	it("serves the observed context-length distribution through the cached web API", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify([
			{
				bucket_key: "under_4k",
				bucket_label: "Under 4K",
				bucket_order: 1,
				requests: 240,
				share_percent: 80,
			},
		]), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/rankings/context-lengths?days=45",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=900, stale-while-revalidate=900",
		);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
			"get_public_context_length_distribution",
		);
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"p_days":45');
		await expect(response.json()).resolves.toMatchObject({
			days: 45,
			data: [{ bucket_key: "under_4k", requests: 240 }],
		});
	});

	it("serves Fastest Models from its dedicated cached RPC", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify([
			{ model_id: "openai/gpt-test", provider: "openai", median_throughput: 42 },
		]), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/rankings/fastest-models?days=30&limit=20",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=900, stale-while-revalidate=900",
		);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("get_public_fastest_models");
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"p_days":30');
	});

	it("serves the Intelligence Index from its dedicated cached RPC", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify([{
			benchmark_id: "aa-intelligence-index-v4",
			benchmark_name: "Artificial Analysis Intelligence Index v4.1.1",
			benchmark_type: "number",
			category: "general",
			model_id: "openai/gpt-test",
			model_name: "GPT Test",
			organisation_id: "openai",
			organisation_name: "OpenAI",
			score: 60,
			rank: 1,
			total_models: 261,
		}]), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/rankings/intelligence-index?limit=20",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=3600, stale-while-revalidate=86400",
		);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("get_public_intelligence_index");
		await expect(response.json()).resolves.toMatchObject({
			benchmark: {
				total_models: 261,
				entries: [{ model_id: "openai/gpt-test", rank: 1 }],
			},
		});
	});

	it("requests exact country rows without the former Other threshold", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify([
			{ country_code: "GB", requests: 75, workspace_count: 1 },
		]), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/rankings/geography?days=30",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"p_min_requests":1');
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"p_min_workspaces":1');
		await expect(response.json()).resolves.toMatchObject({
			data: [{ country_code: "GB", requests: 75 }],
		});
	});
});
