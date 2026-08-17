import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/landing", () => ({
	getLandingStats: vi.fn(async () => ({ db: { models: 2, organisations: 2, benchmarks: 1, benchmark_results: 3, api_providers: 1 }, monthlyTokenTotal: 1000 })),
	getLandingGatewayData: vi.fn(async () => ({ rollup: [], supported: [], topModels: [] })),
	getLandingModelStats: vi.fn(async () => ({ modelsCount: 2, orgsCount: 2, apiCount: 1, recentCount: 1 })),
	listLandingMainModels: vi.fn(async () => [{ model_id: "openai/gpt-test", name: "GPT Test", release_date: "2026-07-01", data_organisations: { organisation_id: "openai", name: "OpenAI", colour: "#000" } }]),
}));
vi.mock("@/repositories/apps", () => ({ listTopApps: vi.fn(async () => []), getPublicAppImages: vi.fn(async () => new Map()) }));

import app from "@/index";
import { listLandingMainModels } from "@/repositories/landing";
const env = { ENV: "development" as const };
afterEach(() => vi.clearAllMocks());

describe("public landing routes", () => {
	it("returns model statistics and selected visible models", async () => {
		const [stats, main] = await Promise.all([app.request("https://phaseo.app/api/_web/landing/models/stats", {}, env), app.request("https://phaseo.app/api/_web/landing/models/main?ids=openai%2Fgpt-test", {}, env)]);
		expect(stats.status).toBe(200); expect(stats.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400"); await expect(stats.json()).resolves.toEqual({ modelsCount: 2, orgsCount: 2, apiCount: 1, recentCount: 1 });
		expect(main.status).toBe(200); expect(main.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=86400, stale-while-revalidate=604800"); await expect(main.json()).resolves.toMatchObject({ models: [{ model_id: "openai/gpt-test", name: "GPT Test" }] });
		expect(listLandingMainModels).toHaveBeenCalledWith(expect.anything(), ["openai/gpt-test"]);
	});

	it("returns database and monthly usage statistics", async () => {
		const response = await app.request("https://phaseo.app/api/_web/landing/stats", {}, env);
		expect(response.status).toBe(200); await expect(response.json()).resolves.toMatchObject({ db: { models: 2 }, monthlyTokenTotal: 1000 });
	});

	it("returns a safe empty gateway showcase", async () => {
		const response = await app.request("https://phaseo.app/api/_web/landing/gateway-showcase?hours=1", {}, env);
		expect(response.status).toBe(200); await expect(response.json()).resolves.toMatchObject({ metrics: { fallback: true, supported: { modelIds: [], providerIds: [] } }, topApps: { data: [] }, topModels: { data: [] } });
	});
});
