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
	for (const method of ["select", "eq", "in", "or", "order"]) {
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
				if (table === "data_api_provider_models") return queryResult({ data: [{
					provider_api_model_id: "pm_1",
					provider_id: "openai",
					api_model_id: "gpt-test",
					model_id: "openai/gpt-test",
					is_active_gateway: true,
					effective_from: null,
					effective_to: null,
				}], error: null });
				if (table === "data_api_provider_model_capabilities") return queryResult({ data: [{
					provider_api_model_id: "pm_1",
					capability_id: "chat/completions",
					effective_from: null,
					effective_to: null,
				}], error: null });
				if (table === "data_models") return queryResult({ data: [{
					model_id: "openai/gpt-test",
					name: "GPT Test",
					hidden: false,
				}], error: null });
				if (table === "data_api_pricing_rules") return queryResult({ data: [{
					model_key: "openai:gpt-test:chat/completions",
					capability_id: "chat/completions",
					pricing_plan: "standard",
					meter: "input_tokens",
					unit: "token",
					unit_size: 1_000_000,
					price_per_unit: "1.5",
					currency: "USD",
					priority: 1,
					match: [],
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
