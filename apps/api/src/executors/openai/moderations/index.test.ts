import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRModerationsRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { execute } from "./index";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

function buildArgs(ir: IRModerationsRequest, providerModelSlug: string | null = null): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_openai_moderations_test",
		workspaceId: "team_test",
		providerId: "openai",
		endpoint: "moderations",
		protocol: "openai.moderations",
		capability: "moderations",
		providerModelSlug,
		capabilityParams: null,
		byokMeta: [],
		pricingCard: null,
		meta: {},
	} as ExecutorExecuteArgs;
}

beforeAll(() => {
	setupTestRuntime();
});

afterAll(() => {
	teardownTestRuntime();
});

describe("openai moderations executor", () => {
	it("preserves multimodal input and nullable legacy categories", async () => {
		let capturedBody: any = null;
		const input = [
			{ type: "text" as const, text: "test input" },
			{
				type: "image_url" as const,
				image_url: { url: "https://example.com/input.png" },
			},
		];
		const mock = installFetchMock([
			{
				match: (url) => url.includes("/moderations"),
				response: jsonResponse({
					id: "modr_multimodal",
					model: "omni-moderation-latest",
					results: [{
						flagged: false,
						categories: { illicit: null, violence: false },
						category_scores: { illicit: 0.01, violence: 0.02 },
						category_applied_input_types: {
							illicit: ["text"],
							violence: ["text", "image"],
						},
					}],
				}),
				onRequest: (call) => {
					capturedBody = call.bodyJson;
				},
			},
		]);

		const result = await execute(buildArgs({
			model: "openai/omni-moderation",
			input,
		}));

		mock.restore();

		expect(capturedBody?.input).toEqual(input);
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") {
			expect(result.ir?.results[0]?.categories).toEqual({
				illicit: null,
				violence: false,
			});
			expect(result.ir?.results[0]?.categoryAppliedInputTypes?.violence).toEqual([
				"text",
				"image",
			]);
		}
	});

	it("normalizes provider-prefixed model ids when provider slug is unavailable", async () => {
		let capturedBody: any = null;
		const mock = installFetchMock([
			{
				match: (url) => url.includes("/moderations"),
				response: jsonResponse({
					id: "modr_1",
					model: "omni-moderation-latest",
					results: [{ flagged: false, categories: {}, category_scores: {} }],
					usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
				}),
				onRequest: (call) => {
					capturedBody = call.bodyJson;
				},
			},
		]);

		const result = await execute(
			buildArgs({
				model: "openai/omni-moderation",
				input: "test input",
			}),
		);

		mock.restore();

		expect(result.upstream.status).toBe(200);
		expect(capturedBody?.model).toBe("omni-moderation");
	});

	it("prefers and normalizes provider model slug when present", async () => {
		let capturedBody: any = null;
		const mock = installFetchMock([
			{
				match: (url) => url.includes("/moderations"),
				response: jsonResponse({
					id: "modr_2",
					model: "omni-moderation-latest",
					results: [{ flagged: false, categories: {}, category_scores: {} }],
				}),
				onRequest: (call) => {
					capturedBody = call.bodyJson;
				},
			},
		]);

		const result = await execute(
			buildArgs(
				{
					model: "openai/omni-moderation",
					input: "test input",
				},
				"openai/omni-moderation-latest",
			),
		);

		mock.restore();

		expect(result.upstream.status).toBe(200);
		expect(capturedBody?.model).toBe("omni-moderation-latest");
	});
});
