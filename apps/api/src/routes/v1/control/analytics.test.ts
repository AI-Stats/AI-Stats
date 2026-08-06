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

function queryResult(
	result: { data: unknown[]; error: unknown; count?: number | null },
	onSelect?: (columns: string) => void,
) {
	const query: Record<string, unknown> = {};
	query.select = vi.fn((columns: string) => {
		onSelect?.(columns);
		return query;
	});
	for (const method of ["eq", "gte", "lt", "in", "order", "range"]) {
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
		let factQueries = 0;
		let countSelection = "";
		getSupabaseAdminMock.mockReturnValue({
			from: vi.fn((table: string) => {
				if (table === "v2_request_facts") {
					factQueries += 1;
					if (factQueries === 1) {
						return queryResult(
							{ data: [], error: null, count: 1 },
							(columns) => { countSelection = columns; },
						);
					}
					return queryResult({ data: [{
					occurred_at: `${yesterday}T12:00:00.000Z`,
					endpoint: "chat/completions",
					requested_model_slug: "openai/gpt-test",
					routed_model_slug: "openai/gpt-test",
					provider_model_id: "openai:gpt-test",
					cost_nanos: "1500000000",
					byok: true,
					v2_request_usage: [
						{ meter_key: "input_tokens", quantity: 20 },
						{ meter_key: "output_tokens", quantity: 5 },
						{ meter_key: "reasoning_tokens", quantity: 2 },
					],
				}], error: null });
				}
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
		expect(countSelection).toBe("request_event_id");
		expect(body.data).toEqual([
			expect.objectContaining({
				date: yesterday,
				model_permaslug: "openai/gpt-test",
				provider_name: "OpenAI",
				endpoint_id: "chat/completions",
				usage: 1.5,
				byok_usage_inference: 1.5,
				requests: 1,
				prompt_tokens: 20,
				completion_tokens: 5,
				reasoning_tokens: 2,
			}),
		]);
	});

	it("fails closed when a raw analytics range exceeds the row cap", async () => {
		let factQueries = 0;
		getSupabaseAdminMock.mockReturnValue({
			from: vi.fn((table: string) => {
				if (table !== "v2_request_facts") throw new Error(`unexpected table: ${table}`);
				factQueries += 1;
				return queryResult({
					data: [],
					error: null,
					count: 10_001,
				});
			}),
		});

		const response = await analyticsRoutes.request("https://example.com/");

		expect(response.status).toBe(413);
		await expect(response.json()).resolves.toMatchObject({
			ok: false,
			error: "analytics_range_too_large",
		});
		expect(factQueries).toBe(1);
	});
});
