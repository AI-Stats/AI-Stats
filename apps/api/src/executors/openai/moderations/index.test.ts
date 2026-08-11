import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRModerationsRequest } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorUpstreamTiming } from "@executors/types";
import { execute } from "./index";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

function buildArgs(
	ir: IRModerationsRequest,
	providerModelSlug: string | null = null,
	providerId = "openai",
): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_openai_moderations_test",
		workspaceId: "team_test",
		providerId,
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

	it("records upstream latency and OpenAI processing time in milliseconds", async () => {
		const mock = installFetchMock([
			{
				match: (url) => url.includes("/moderations"),
				response: jsonResponse(
					{
						id: "modr_timing_openai",
						model: "omni-moderation-latest",
						results: [{ flagged: false, categories: {}, category_scores: {} }],
					},
					{ headers: { "openai-processing-ms": "12.5" } },
				),
			},
		]);
		const upstreamTiming: ExecutorUpstreamTiming = {
			fetch: (input, init) => globalThis.fetch(input, init),
			timingFor: () => ({
				phase: "provider",
				sequence: 1,
				dispatchAtMs: Date.now() - 27,
				headersAtMs: Date.now(),
				headersMs: 27,
			}),
		};

		const result = await execute({
			...buildArgs({ model: "openai/omni-moderation-latest", input: "test input" }),
			upstreamTiming,
		});

		mock.restore();

		expect(result.timing).toMatchObject({ latencyMs: 27, generationMs: 12.5 });
	});

	it("falls back to observed upstream latency when a compatible provider omits processing time", async () => {
		const mock = installFetchMock([
			{
				match: (url) => url.includes("/moderations"),
				response: jsonResponse({
					id: "modr_timing_mistral",
					model: "mistral-moderation-latest",
					results: [{ flagged: false, categories: {}, category_scores: {} }],
				}),
			},
		]);
		const upstreamTiming: ExecutorUpstreamTiming = {
			fetch: (input, init) => globalThis.fetch(input, init),
			timingFor: () => ({
				phase: "provider",
				sequence: 1,
				dispatchAtMs: Date.now() - 31,
				headersAtMs: Date.now(),
				headersMs: 31,
			}),
		};

		const result = await execute({
			...buildArgs(
				{ model: "mistral/mistral-moderation-latest", input: "test input" },
				"mistral-moderation-latest",
				"mistral",
			),
			upstreamTiming,
		});

		mock.restore();

		expect(result.timing).toMatchObject({ latencyMs: 31, generationMs: 31 });
	});

	it("records timing for failed upstream moderation attempts without treating them as successful responses", async () => {
		const mock = installFetchMock([
			{
				match: (url) => url.includes("/moderations"),
				response: jsonResponse(
					{ error: { message: "rate limited" } },
					{ status: 429, headers: { "openai-processing-ms": "9" } },
				),
			},
		]);
		const upstreamTiming: ExecutorUpstreamTiming = {
			fetch: (input, init) => globalThis.fetch(input, init),
			timingFor: () => ({
				phase: "provider",
				sequence: 1,
				dispatchAtMs: Date.now() - 18,
				headersAtMs: Date.now(),
				headersMs: 18,
			}),
		};

		const result = await execute({
			...buildArgs({ model: "openai/omni-moderation-latest", input: "test input" }),
			upstreamTiming,
		});

		mock.restore();

		expect(result.upstream.ok).toBe(false);
		expect(result.timing).toMatchObject({ latencyMs: 18, generationMs: 9 });
	});
});
