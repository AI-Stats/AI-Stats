import { beforeEach, describe, expect, it, vi } from "vitest";

const guardAuthMock = vi.fn();
const loadPricingCatalogueRowsMock = vi.fn();

vi.mock("@pipeline/before/guards", () => ({
	guardAuth: (...args: unknown[]) => guardAuthMock(...args),
}));

vi.mock("@/repositories/pricing", () => ({
	loadPricingCatalogueRows: (...args: unknown[]) => loadPricingCatalogueRowsMock(...args),
}));

vi.mock("../../utils", () => ({
	withRuntime:
		(handler: (req: Request) => Promise<Response>) =>
		async (c: { req: { raw: Request } }) =>
			handler(c.req.raw),
	json: (data: unknown, status = 200, headers: Record<string, string> = {}) =>
		new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } }),
	cacheHeaders: () => ({ "Cache-Control": "private, max-age=300" }),
}));

import { pricingRoutes } from "./pricing";

describe("pricingRoutes", () => {
	beforeEach(() => {
		guardAuthMock.mockReset();
		loadPricingCatalogueRowsMock.mockReset();
		guardAuthMock.mockResolvedValue({
			ok: true,
			value: {
				workspaceId: "ws_test",
				authMethod: "oauth",
				oauthScopes: ["pricing:read"],
			},
		});
	});

	it("includes active rows with open effective windows and avoids empty in filters", async () => {
		loadPricingCatalogueRowsMock.mockResolvedValue({
			routes: [{ providerModelId: "pm_1", providerSlug: "openai", modelSlug: "openai/gpt-test" }],
			models: [{ modelSlug: "openai/gpt-test", name: "GPT Test", hidden: false, status: "active" }],
			skus: [{
					skuId: "sku_1",
					providerModelId: "pm_1",
					operation: "chat/completions",
					serviceTierSlug: "standard",
					currency: "USD",
					metadata: {},
			}],
			meters: [{
					skuId: "sku_1",
					meterKey: "input_tokens",
					unit: "token",
					unitQuantity: 1_000_000,
					priceNanos: 1_500_000_000,
					metadata: {},
					meterOrder: 1,
			}],
		});

		const response = await pricingRoutes.request("https://example.com/models");
		const body = await response.json() as { ok: boolean; models: Array<{ model: string; meters: unknown[] }> };

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.models).toEqual([
			expect.objectContaining({ model: "openai/gpt-test", meters: [expect.objectContaining({ meter: "input_tokens" })] }),
		]);
	});
});
