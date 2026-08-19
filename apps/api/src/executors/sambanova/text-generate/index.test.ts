import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
beforeAll(() => setupRuntimeFromEnv({ SAMBANOVA_API_KEY: "sn-test" } as any));
afterAll(teardownTestRuntime);

describe("SambaNova text.generate contract", () => {
	it("uses Responses and preserves reasoning/cached usage while dropping ignored fields", async () => {
		const mock = installFetchMock([{
			match: (url) => url === "https://api.sambanova.ai/v1/responses",
			response: jsonResponse({
				id: "resp_sn_1",
				object: "response",
				created_at: 1,
				model: "gpt-oss-120b",
				status: "completed",
				output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "hello" }] }],
				usage: {
					input_tokens: 12,
					output_tokens: 8,
					total_tokens: 20,
					input_tokens_details: { cached_tokens: 2 },
					output_tokens_details: { reasoning_tokens: 3 },
				},
			}),
		}]);
		const result = await executor({
			ir: {
				model: "openai/gpt-oss-120b",
				messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
				stream: false,
				maxTokens: 128,
				temperature: 0.2,
				topP: 0.9,
				topK: 10,
				presencePenalty: 1,
				frequencyPenalty: 1,
				reasoning: { effort: "high" },
			} as any,
			requestId: "req_sn",
			workspaceId: "ws_sn",
			providerId: "sambanova",
			endpoint: "responses",
			protocol: "openai.responses",
			capability: "text.generate",
			providerModelSlug: "gpt-oss-120b",
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer sn-test");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "gpt-oss-120b",
			max_output_tokens: 128,
			temperature: 0.2,
			top_p: 0.9,
			top_k: 10,
			reasoning: { effort: "high" },
		});
		expect(mock.calls[0]?.bodyJson?.presence_penalty).toBeUndefined();
		expect(mock.calls[0]?.bodyJson?.frequency_penalty).toBeUndefined();
		expect((result as any).ir.usage).toMatchObject({
			inputTokens: 12,
			outputTokens: 8,
			totalTokens: 20,
			cachedInputTokens: 2,
			reasoningTokens: 3,
		});
	});
});
