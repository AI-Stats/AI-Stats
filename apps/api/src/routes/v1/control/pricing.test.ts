import { beforeEach, describe, expect, it, vi } from "vitest";

const guardAuthMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("@pipeline/before/guards", () => ({
	guardAuth: (...args: unknown[]) => guardAuthMock(...args),
}));

vi.mock("@/runtime/env", () => ({
	getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
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

function queryResult(result: { data: unknown[]; error: unknown }) {
	const query: Record<string, unknown> = {};
	for (const method of ["select", "eq", "in", "lte", "or", "order"]) {
		query[method] = vi.fn(() => query);
	}
	query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
	return query;
}

describe("pricingRoutes", () => {
	beforeEach(() => {
		guardAuthMock.mockReset();
		getSupabaseAdminMock.mockReset();
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
		getSupabaseAdminMock.mockReturnValue({
			from: vi.fn((table: string) => {
				if (table === "v2_model_provider_routes") return queryResult({ data: [{
					provider_model_id: "pm_1",
					provider_slug: "openai",
					model_slug: "openai/gpt-test",
				}], error: null });
				if (table === "v2_models") return queryResult({ data: [{
					model_slug: "openai/gpt-test",
					name: "GPT Test",
					hidden: false,
					status: "active",
				}], error: null });
				if (table === "v2_pricing_skus") return queryResult({ data: [{
					sku_id: "sku_1",
					provider_model_id: "pm_1",
					operation: "chat/completions",
					service_tier_slug: "standard",
					currency: "USD",
					metadata: {},
				}], error: null });
				if (table === "v2_pricing_sku_meters") return queryResult({ data: [{
					sku_id: "sku_1",
					meter_key: "input_tokens",
					unit: "token",
					unit_quantity: 1_000_000,
					price_nanos: 1_500_000_000,
					metadata: {},
					meter_order: 1,
				}], error: null });
				throw new Error(`unexpected table: ${table}`);
			}),
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
