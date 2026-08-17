import { afterEach, describe, expect, it, vi } from "vitest";
const loadModelAvailabilitySources = vi.hoisted(() => vi.fn());
vi.mock("@/repositories/model-availability", () => ({ loadModelAvailabilitySources }));
import app from "@/index";

const env = {
	ENV: "development" as const,
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("credit model availability route", () => {
	it("returns creator logos with an edge-cached country preview", async () => {
		loadModelAvailabilitySources.mockResolvedValue({
			routes: [{
					provider_model_id: "openai:gpt-test",
					provider_slug: "openai",
					model_slug: "openai/gpt-test",
					metadata: {},
					effective_from: null,
					effective_to: null,
				}],
			providers: [{
					provider_slug: "openai",
					metadata: {
						availability: {
							mode: "allowlist",
							countries: ["US"],
						},
					},
				}],
			models: [{
					model_slug: "openai/gpt-test",
					name: "GPT Test",
					lab_slug: "openai",
					lab_name: "OpenAI",
				}],
		});

		const response = await app.request(
			"https://phaseo.app/api/_web/credits/model-availability?country=CN",
			{},
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=900, s-maxage=900, stale-while-revalidate=900",
		);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=900, stale-while-revalidate=900",
		);
		expect(response.headers.get("cache-tag")).toBe("web-api-credit-model-availability");
		await expect(response.json()).resolves.toEqual({
			countryCode: "CN",
			restrictedModels: [{ id: "openai/gpt-test", name: "GPT Test", logoId: "openai", organisationName: "OpenAI" }],
			regionRestrictedModels: [],
		});
	});

	it("does not cache invalid country responses", async () => {
		const response = await app.request(
			"https://phaseo.app/api/_web/credits/model-availability?country=XX",
			{},
			env,
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
});
