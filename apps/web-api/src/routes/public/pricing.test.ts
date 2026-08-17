import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/pricing", () => ({
	listPublicPricingRows: vi.fn(async () => [{
		providerModelId: "provider:gpt-5.6-sol", providerSlug: "openai", providerModelSlug: "gpt-5.6-sol",
		modelSlug: "openai/gpt-5.6-sol", modelName: "GPT 5.6 Sol", releasedAt: "2026-07-09T00:00:00Z",
		announcedAt: null, skuId: "00000000-0000-4000-8000-000000000001", operation: "text.generate",
		serviceTierSlug: "standard", currency: "USD", skuMetadata: { billing_timestamp_basis: "request_start" },
		meterKey: "input_text_tokens", unit: "token", unitQuantity: "1000000", priceNanos: "5000000000", meterMetadata: {},
	}]),
}));

import app from "@/index";
import { listPublicPricingRows } from "@/repositories/pricing";

const env = { ENV: "development" as const };
const listRows = vi.mocked(listPublicPricingRows);

afterEach(() => vi.clearAllMocks());

describe("public pricing routes", () => {
	it("returns grouped public model pricing from the Drizzle repository", async () => {
		const response = await app.request("https://phaseo.app/api/_web/pricing/models", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400");
		await expect(response.json()).resolves.toMatchObject({ models: [{
			model: "openai/gpt-5.6-sol", display_name: "GPT 5.6 Sol", provider: "openai", endpoint: "text.generate",
			meters: [{ meter: "input_text_tokens", price_per_unit: "5" }],
		}] });
	});

	it("passes the bounded, de-duplicated model filter to the repository", async () => {
		const ids = Array.from({ length: 105 }, (_, index) => `lab/model-${index}`);
		const response = await app.request(`https://phaseo.app/api/_web/pricing/models?model_ids=${encodeURIComponent([ids[0], ...ids, ids[0]].join(","))}`, {}, env);
		expect(response.status).toBe(200);
		expect(listRows).toHaveBeenCalledOnce();
		const passedIds = listRows.mock.calls[0]?.[1] ?? [];
		expect(passedIds).toHaveLength(100);
		expect(new Set(passedIds).size).toBe(100);
	});

	it("rejects cache-busting parameters before accessing the database", async () => {
		const response = await app.request("https://phaseo.app/api/_web/pricing/models?cb=random", {}, env);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: "unsupported_query_parameter" });
		expect(listRows).not.toHaveBeenCalled();
	});

	it("fails closed and disables caching when the database query fails", async () => {
		listRows.mockRejectedValueOnce(new Error("database unavailable"));
		const response = await app.request("https://phaseo.app/api/_web/pricing/models", {}, env);
		expect(response.status).toBe(503);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
		await expect(response.json()).resolves.toEqual({ error: "pricing_models_unavailable" });
	});
});
