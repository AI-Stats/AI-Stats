import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";

const env = {
	ENV: "development" as const,
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

afterEach(() => vi.unstubAllGlobals());

describe("public compare routes", () => {
	it("returns final compare usage from one cached Worker request", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("get_public_compare_realtime")) return new Response(JSON.stringify([{
				model_id: "openai/gpt-test", realtime_requests: 2, realtime_latency_p50: 75, realtime_throughput_p50: 100,
			}]), { status: 200 });
			if (url.includes("get_model_performance_overview")) return new Response(JSON.stringify([{
				last_24h: { total_requests: 5 }, hourly_24h: [],
			}]), { status: 200 });
			if (url.includes("get_model_token_trajectory")) return new Response(JSON.stringify([{ points: [] }]), { status: 200 });
			return new Response("[]", { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request("https://phaseo.app/api/_web/compare/usage?ids=openai%2Fgpt-test", {}, env);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=300, stale-while-revalidate=300");
		await expect(response.json()).resolves.toMatchObject({ usage: {
			"openai/gpt-test": { totalRequests: 5, requests30m: 2, latencyP50Ms30m: 75, throughputP50TokPerSec30m: 100 },
		} });
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("get_public_compare_realtime"))).toBe(true);
	});

	it("rejects oversized detailed selections before querying the database", async () => {
		const response = await app.request("https://phaseo.app/api/_web/compare/selection?ids=a,b,c,d,e", {}, env);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: "invalid_compare_selection" });
	});

	it("returns detailed models from one batch endpoint", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
			if (url.pathname.endsWith("/v2_models")) return new Response(JSON.stringify([{
				model_slug: "openai/gpt-test",
				name: "GPT Test",
				lab_slug: "openai",
				status: "active",
				input_modalities: ["text"],
				output_modalities: ["text"],
				lab: { lab_slug: "openai", name: "OpenAI" },
			}]), { status: 200 });
			return new Response("[]", { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request("https://phaseo.app/api/_web/compare/selection?ids=openai%2Fgpt-test", {}, env);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toContain("max-age=3600");
		await expect(response.json()).resolves.toMatchObject({
			models: [{ id: "openai/gpt-test", name: "GPT Test", benchmark_results: [], prices: [] }],
		});
		const modelUrls = fetchMock.mock.calls.map(([input]) => String(input));
		expect(modelUrls.filter((url) => url.includes("/v2_models?")).length).toBe(1);
	});

	it("returns the visible compare catalogue with edge cache headers", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{
			model_slug: "openai/gpt-test",
			name: "GPT Test",
			lab_slug: "openai",
			status: "active",
			announced_at: "2026-06-01",
			released_at: "2026-07-01",
			deprecated_at: null,
			retired_at: null,
			input_modalities: ["text"],
			output_modalities: ["text"],
			lab: { lab_slug: "openai", name: "OpenAI" },
		}]), { status: 200 })));

		const response = await app.request("https://phaseo.app/api/_web/compare/models", {}, env);

		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=3600, stale-while-revalidate=86400",
		);
		expect(response.headers.get("cache-tag")).toContain("web-api-compare");
		await expect(response.json()).resolves.toMatchObject({
			models: [{
				id: "openai/gpt-test",
				name: "GPT Test",
				provider: { provider_id: "openai", name: "OpenAI" },
			}],
		});
	});
});
