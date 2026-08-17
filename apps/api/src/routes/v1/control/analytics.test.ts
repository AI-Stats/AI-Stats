import { beforeEach, describe, expect, it, vi } from "vitest";

const guardAuthMock = vi.fn();
const countAnalyticsFactsMock = vi.hoisted(() => vi.fn());
const loadAnalyticsFactsPageMock = vi.hoisted(() => vi.fn());
const loadAnalyticsProviderNamesMock = vi.hoisted(() => vi.fn());

vi.mock("@/pipeline/before/guards", () => ({
	guardAuth: (...args: unknown[]) => guardAuthMock(...args),
}));

vi.mock("@/repositories/analytics", () => ({
	countAnalyticsFacts: (...args: unknown[]) => countAnalyticsFactsMock(...args),
	loadAnalyticsFactsPage: (...args: unknown[]) => loadAnalyticsFactsPageMock(...args),
	loadAnalyticsProviderNames: (...args: unknown[]) => loadAnalyticsProviderNamesMock(...args),
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

describe("analyticsRoutes", () => {
	beforeEach(() => {
		guardAuthMock.mockReset();
		countAnalyticsFactsMock.mockReset();
		loadAnalyticsFactsPageMock.mockReset();
		loadAnalyticsProviderNamesMock.mockReset();
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
		countAnalyticsFactsMock.mockResolvedValue(1);
		loadAnalyticsFactsPageMock.mockResolvedValueOnce([{
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
		}]).mockResolvedValueOnce([]);
		loadAnalyticsProviderNamesMock.mockResolvedValue([{ provider_model_id: "openai:gpt-test", provider_slug: "openai" }]);
		const response = await analyticsRoutes.request("https://example.com/");
		const body = await response.json() as { data: Array<Record<string, unknown>> };

		expect(response.status).toBe(200);
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
		countAnalyticsFactsMock.mockResolvedValue(10_001);

		const response = await analyticsRoutes.request("https://example.com/");

		expect(response.status).toBe(413);
		await expect(response.json()).resolves.toMatchObject({
			ok: false,
			error: "analytics_range_too_large",
		});
		expect(countAnalyticsFactsMock).toHaveBeenCalledTimes(1);
	});
});
