import { afterEach, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./index";

afterEach(teardownTestRuntime);

function args(ir: IRChatRequest): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_parasail",
		workspaceId: "ws_parasail",
		providerId: "parasail",
		endpoint: "chat/completions",
		protocol: "openai.chat.completions",
		capability: "text.generate",
		providerModelSlug: "parasail-qwen3-32b",
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

describe("Parasail text generation", () => {
	it("uses the official host and preserves vLLM sampling, tools, response, and usage", async () => {
		setupRuntimeFromEnv({ PARASAIL_API_KEY: "test-parasail-key" } as any);
		const mock = installFetchMock([{
			match: (url) => url === "https://api.parasail.io/v1/chat/completions",
			response: jsonResponse({
				id: "chatcmpl_parasail", object: "chat.completion", created: 1,
				model: "parasail-qwen3-32b",
				choices: [{ index: 0, message: { role: "assistant", content: "Albany" }, finish_reason: "stop" }],
				usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 },
			}),
		}]);
		const result = await execute(args({
			model: "parasail/parasail-qwen3-32b", stream: false,
			messages: [{ role: "user", content: [{ type: "text", text: "Capital of New York?" }] }],
			maxTokens: 64, temperature: 0, topP: 0.9, topK: 40, repetitionPenalty: 1.1, seed: 7,
			tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }], toolChoice: "auto",
		}));
		mock.restore();
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer test-parasail-key");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "parasail-qwen3-32b", max_tokens: 64, temperature: 0, top_p: 0.9,
			top_k: 40, repetition_penalty: 1.1, seed: 7, tool_choice: "auto",
		});
		expect((result as any).ir?.choices?.[0]?.message?.content?.[0]?.text).toBe("Albany");
		expect((result as any).bill?.usage).toMatchObject({ input_tokens: 9, output_tokens: 2, total_tokens: 11 });
	});

	it("passes through Parasail streaming SSE and requests terminal usage", async () => {
		setupRuntimeFromEnv({ PARASAIL_API_KEY: "test-parasail-key" } as any);
		const mock = installFetchMock([{
			match: (url) => url === "https://api.parasail.io/v1/chat/completions",
			response: new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await execute(args({ model: "parasail/parasail-qwen3-32b", stream: true, messages: [{ role: "user", content: [{ type: "text", text: "Hi" }] }] }));
		mock.restore();
		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.bodyJson).toMatchObject({ stream: true, stream_options: { include_usage: true } });
	});
});
