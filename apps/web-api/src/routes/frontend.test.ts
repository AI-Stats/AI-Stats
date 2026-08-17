import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadSearchCatalogue: vi.fn(), getCacheGeneration: vi.fn() }));
vi.mock("@/repositories/search", () => ({ loadSearchCatalogue: mocks.loadSearchCatalogue }));
vi.mock("@/cache/generations", () => ({ getCacheGeneration: mocks.getCacheGeneration }));
import app from "@/index";

const env = {
	ENV: "development" as const,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("frontend search route", () => {
	it("serves the database-composed index with a one-day browser cache", async () => {
		const payload = {
			m: [["openai/gpt-test", "GPT Test", "OpenAI", "/models/openai/gpt-test", "openai", "July 2026"]],
			o: [["openai", "OpenAI", null, "/organisations/openai", "openai"]],
			b: [],
			p: [["openai", "OpenAI", null, "/api-providers/openai", "openai"]],
			s: [],
			c: [],
			v: 7,
		};
		mocks.loadSearchCatalogue.mockResolvedValue({
			models: [{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", released_at: "2026-07-01", announced_at: null, lab_name: "OpenAI" }],
			organisations: [{ lab_slug: "openai", name: "OpenAI" }], benchmarks: [], providers: [{ provider_slug: "openai", name: "OpenAI" }],
		});
		mocks.getCacheGeneration.mockResolvedValue({ scope: "search", generation: 7, updatedAt: null });

		const response = await app.request(
			"https://phaseo.app/api/_web/search",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(mocks.loadSearchCatalogue).toHaveBeenCalledWith(env);
		expect(mocks.getCacheGeneration).toHaveBeenCalledWith(env, "search");
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
		);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=86400, stale-while-revalidate=604800",
		);
		expect(response.headers.get("cache-tag")).toBe("web-api-search");
		await expect(response.json()).resolves.toEqual(payload);
	});

	it("serves a short edge-cached browser generation marker", async () => {
		mocks.getCacheGeneration.mockResolvedValue({ scope: "search", generation: 9, updatedAt: "2026-07-17T22:00:00.000Z" });

		const response = await app.request(
			"https://phaseo.app/api/_web/cache-generation/search",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=0, s-maxage=300, stale-while-revalidate=300",
		);
		expect(response.headers.get("cache-tag")).toBe("web-api-cache-generation");
		await expect(response.json()).resolves.toEqual({
			scope: "search",
			generation: 9,
			updatedAt: "2026-07-17T22:00:00.000Z",
		});
	});
});
