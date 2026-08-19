import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRModerationsRequest } from "@core/ir";
import { resolveProviderExecutor } from "@executors/index";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./index";

beforeAll(() => setupRuntimeFromEnv({ OVH_AI_ENDPOINTS_ACCESS_TOKEN: "ovh-test-key" } as any));
afterAll(teardownTestRuntime);

function args(input: IRModerationsRequest["input"]): ExecutorExecuteArgs {
	return {
		ir: { model: "qwen/qwen3-guard-gen-8b", input },
		requestId: "req_ovh_guard",
		workspaceId: "ws_ovh",
		providerId: "ovhcloud",
		endpoint: "moderations",
		protocol: "openai.moderations",
		capability: "moderations",
		providerModelSlug: "Qwen3Guard-Gen-8B",
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

describe("OVHcloud Qwen3Guard moderation adapter", () => {
	it("calls Chat Completions and parses safety, categories, and usage", async () => {
		expect(resolveProviderExecutor("ovhcloud", "moderations")).toBeTruthy();
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/chat/completions"),
			response: jsonResponse({
				id: "chatcmpl_guard_1",
				model: "Qwen3Guard-Gen-8B",
				choices: [{ message: { role: "assistant", content: "Safety: Unsafe\nCategories: Non-violent Illegal Acts, PII\nRefusal: Yes" } }],
				usage: { prompt_tokens: 8, completion_tokens: 10, total_tokens: 18 },
			}),
		}]);
		const result = await execute(args("sensitive request"));
		mock.restore();

		expect(mock.calls[0]?.bodyJson).toEqual({
			model: "Qwen3Guard-Gen-8B",
			messages: [{ role: "user", content: "sensitive request" }],
			temperature: 0,
			max_tokens: 512,
		});
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") {
			expect(result.ir).toMatchObject({
				model: "Qwen3Guard-Gen-8B",
				results: [{
					flagged: true,
					categories: { non_violent_illegal_acts: true, pii: true, violent: false },
				}],
				usage: { inputTokens: 8, outputTokens: 10, totalTokens: 18 },
			});
		}
	});

	it("maps batched strings one-for-one and rejects unsupported multimodal input", async () => {
		let callIndex = 0;
		const responses = [
			{ choices: [{ message: { content: "Safety: Safe\nCategories: None\nRefusal: No" } }] },
			{ choices: [{ message: { content: "Safety: Controversial\nCategories: Politically Sensitive Topics\nRefusal: No" } }] },
		];
		const mock = installFetchMock([{
			match: () => true,
			response: () => jsonResponse(responses[callIndex++]!),
		}]);
		const batch = await execute(args(["safe", "politics"]));
		mock.restore();
		expect(batch.kind).toBe("completed");
		if (batch.kind === "completed") {
			expect(batch.ir?.results).toHaveLength(2);
			expect(batch.ir?.results[0]?.flagged).toBe(false);
			expect(batch.ir?.results[1]?.flagged).toBe(true);
		}

		const invalid = await execute(args([{ type: "image_url", image_url: { url: "https://example.com/image.png" } }]));
		expect(invalid.upstream.status).toBe(400);
	});
});
