import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ STREAMLAKE_API_KEY: "streamlake-test-key" } as any));
afterAll(() => teardownTestRuntime());

describe("StreamLake text.generate contract", () => {
	it("calls the pay-as-you-go Chat endpoint with the preset model ID and normalizes SSE usage", async () => {
		const mock = installFetchMock([{
			match: (url) => url === "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chatcmpl_sl", object: "chat.completion.chunk", model: "kat-coder-pro-v2.5", choices: [{ index: 0, delta: { role: "assistant", content: "Hello" }, finish_reason: null }] })}\n\n`,
				`data: ${JSON.stringify({ id: "chatcmpl_sl", object: "chat.completion.chunk", model: "kat-coder-pro-v2.5", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16, prompt_tokens_details: { cached_tokens: 3 } } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { headers: { "Content-Type": "text/event-stream" } }),
		}]);

		const result = await executor({
			ir: {
				model: "kwaipilot/kat-coder-pro-v2.5",
				stream: false,
				messages: [{ role: "user", content: [{ type: "text", text: "Say hello" }] }],
				maxTokens: 128,
				temperature: 0.2,
				tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
			},
			requestId: "req_streamlake",
			workspaceId: "ws_streamlake",
			providerId: "streamlake",
			endpoint: "chat.completions",
			protocol: "openai.chat.completions",
			capability: "text.generate",
			providerModelSlug: "kat-coder-pro-v2.5",
			capabilityParams: { params: ["max_tokens", "temperature", "tools"] },
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: {},
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer streamlake-test-key");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "kat-coder-pro-v2.5",
			max_tokens: 128,
			temperature: 0.2,
			stream: true,
			stream_options: { include_usage: true },
		});
		expect(mock.calls[0]?.bodyJson.tools[0].function.name).toBe("lookup");
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") {
			expect(result.ir.usage).toMatchObject({
				inputTokens: 12,
				outputTokens: 4,
				totalTokens: 16,
				cachedInputTokens: 3,
			});
		}
	});
});
