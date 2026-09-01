import { beforeEach, describe, expect, it, vi } from "vitest";

const guardAuthMock = vi.fn();
const fetchCatalogueMock = vi.fn();

vi.mock("@/pipeline/before/guards", () => ({
	guardAuth: (...args: any[]) => guardAuthMock(...args),
}));

vi.mock("./models.catalogue", () => ({
	fetchCatalogue: (...args: any[]) => fetchCatalogueMock(...args),
}));

vi.mock("../../utils", () => ({
	withRuntime:
		(handler: (req: Request) => Promise<Response>) =>
		async (c: { req: { raw: Request } }) =>
			handler(c.req.raw),
	json: (data: unknown, status = 200, headers: Record<string, string> = {}) =>
		new Response(JSON.stringify(data), {
			status,
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
		}),
	cacheHeaders: () => ({ "Cache-Control": "public, max-age=1800" }),
}));

import { placeholdersRoutes } from "./placeholders";

describe("placeholdersRoutes /endpoints", () => {
	beforeEach(() => {
		guardAuthMock.mockReset();
		fetchCatalogueMock.mockReset();
		guardAuthMock.mockResolvedValue({
			ok: true,
			value: {
				workspaceId: "ws_test",
			},
		});
	});

	it("returns capability-backed endpoint counts and sample models", async () => {
		fetchCatalogueMock.mockResolvedValue([
			{
				model_id: "openai/gpt-5-nano",
				endpoints: ["responses", "chat.completions"],
				providers: [
					{ api_provider_id: "openai", endpoints: ["responses", "chat.completions"] },
					{ api_provider_id: "azure", endpoints: ["responses"] },
				],
			},
			{
				model_id: "anthropic/claude-sonnet-4",
				endpoints: ["messages"],
				providers: [{ api_provider_id: "anthropic", endpoints: ["messages"] }],
			},
		]);

		const response = await placeholdersRoutes.request("https://example.com/endpoints");

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			ok: true,
			endpoints: ["chat.completions", "messages", "responses"],
			data: expect.arrayContaining([
				expect.objectContaining({
					id: "responses",
					public_path: "/v1/responses",
					model_count: 1,
					provider_count: 2,
				}),
			]),
			sample_models: [
				"openai/gpt-5-nano",
				"anthropic/claude-sonnet-4",
			],
		});
	});

	it("surfaces backend lookup failures as a 500 payload", async () => {
		fetchCatalogueMock.mockRejectedValue(new Error("db unavailable"));

		const response = await placeholdersRoutes.request("https://example.com/endpoints");

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			ok: false,
			error: "failed",
			message: "db unavailable",
		});
	});

	it("aggregates capability aliases under one canonical endpoint", async () => {
		fetchCatalogueMock.mockResolvedValue([
			{
				model_id: "phaseo/image-model",
				endpoints: ["image.generate", "images.generations"],
				providers: [
					{ api_provider_id: "provider-a", endpoints: ["image.generate"] },
					{ api_provider_id: "provider-b", endpoints: ["images.generations"] },
				],
			},
		]);

		const response = await placeholdersRoutes.request("https://example.com/endpoints");
		const payload = await response.json() as any;

		expect(payload.data.filter((entry: any) => entry.id === "images.generations")).toEqual([{
			id: "images.generations",
			capability_id: "images.generations",
			public_path: "/v1/images/generations",
			collection: "images",
			model_count: 1,
			provider_count: 2,
		}]);
	});

	it("ignores catalogue features that are not callable endpoints", async () => {
		fetchCatalogueMock.mockResolvedValue([{
			model_id: "openai/gpt-test",
			endpoints: ["responses", "structured.output"],
			providers: [{ api_provider_id: "openai", endpoints: ["responses", "structured.output"] }],
		}]);

		const response = await placeholdersRoutes.request("https://example.com/endpoints");
		const payload = await response.json() as any;

		expect(response.status).toBe(200);
		expect(payload.endpoints).toEqual(["responses"]);
		expect(payload.data).toEqual([expect.objectContaining({ id: "responses", provider_count: 1 })]);
	});

	it("requires models:read from OAuth callers", async () => {
		guardAuthMock.mockResolvedValue({
			ok: true,
			value: {
				workspaceId: "ws_test",
				authMethod: "oauth",
				scopes: ["openid"],
			},
		});

		const response = await placeholdersRoutes.request("https://example.com/endpoints");

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: "insufficient_scope",
			message: "Token requires models:read",
		});
		expect(fetchCatalogueMock).not.toHaveBeenCalled();
	});
});
