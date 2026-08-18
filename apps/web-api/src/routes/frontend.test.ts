import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";

const env = {
	ENV: "development" as const,
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

afterEach(() => {
	vi.unstubAllGlobals();
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
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			let value: unknown[];
			if (url.includes("v2_models")) value = [{ model_slug: "openai/gpt-test", name: "GPT Test", lab_slug: "openai", released_at: "2026-07-01", lab: { name: "OpenAI" } }];
			else if (url.includes("v2_labs")) value = [{ lab_slug: "openai", name: "OpenAI" }];
			else if (url.includes("v2_providers")) value = [{ provider_slug: "openai", name: "OpenAI" }];
			else if (url.includes("web_cache_generations")) value = [{ generation: 7, updated_at: null }];
			else value = [];
			return new Response(JSON.stringify(value), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/_web/search",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(5);
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
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			expect(String(input)).toContain("/rest/v1/web_cache_generations");
			return new Response(JSON.stringify({ generation: 9, updated_at: "2026-07-17T22:00:00.000Z" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

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
