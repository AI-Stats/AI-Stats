import { beforeEach, describe, expect, it, vi } from "vitest";

const guardAuthMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("@/pipeline/before/guards", () => ({
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
}));

import { analyticsRoutes } from "./analytics";

function queryResult(result: { data: unknown[]; error: unknown }) {
	const query: Record<string, unknown> = {};
	for (const method of ["select", "eq", "gte", "lt", "in"]) {
		query[method] = vi.fn(() => query);
	}
	query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
	return query;
}

describe("analyticsRoutes", () => {
	beforeEach(() => {
		guardAuthMock.mockReset();
		getSupabaseAdminMock.mockReset();
		guardAuthMock.mockResolvedValue({
			ok: true,
			value: {
				workspaceId: "ws_test",
				authMethod: "oauth",
				oauthScopes: ["analytics:read"],
			},
		});
	});

	it("loads the current v2 daily rollup and aggregates meter totals", async () => {
		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		getSupabaseAdminMock.mockReturnValue({
			from: vi.fn((table: string) => {
				if (table === "v2_private_usage_daily") return queryResult({ data: [{
					usage_date: yesterday,
					model_slug: "openai/gpt-test",
					provider_model_id: "openai:gpt-test",
					cost_nanos: "1500000000",
					requests: 3,
					successful_requests: 2,
					v2_private_usage_daily_meters: [
						{ meter_key: "input_tokens", quantity: 20 },
						{ meter_key: "output_tokens", quantity: 5 },
						{ meter_key: "reasoning_tokens", quantity: 2 },
					],
				}], error: null });
				if (table === "v2_model_provider_routes") return queryResult({ data: [{
					provider_model_id: "openai:gpt-test",
					provider_slug: "openai",
				}], error: null });
				throw new Error(`unexpected table: ${table}`);
			}),
		});

		const response = await analyticsRoutes.request("https://example.com/");
		const body = await response.json() as { data: Array<Record<string, unknown>> };

		expect(response.status).toBe(200);
		expect(body.data).toEqual([
			expect.objectContaining({
				date: yesterday,
				model_permaslug: "openai/gpt-test",
				provider_name: "OpenAI",
				usage: 1.5,
				requests: 2,
				prompt_tokens: 20,
				completion_tokens: 5,
				reasoning_tokens: 2,
			}),
		]);
	});
});
