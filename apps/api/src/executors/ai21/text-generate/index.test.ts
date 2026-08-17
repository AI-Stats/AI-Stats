import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { executor, preprocess } from "./index";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

function args(ir: IRChatRequest): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_ai21_contract",
		workspaceId: "ws_ai21_contract",
		providerId: "ai21",
		endpoint: "chat.completions",
		protocol: "openai.chat.completions",
		capability: "text.generate",
		providerModelSlug: "jamba-large-1.7-2025-07",
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

beforeAll(setupTestRuntime);
afterAll(teardownTestRuntime);

describe("AI21 text generate contract", () => {
	it("preserves AI21 n and documents through Chat decode and provider encoding", () => {
		const parsed = ChatCompletionsSchema.parse({
			model: "ai21/jamba-large-1.7",
			messages: [{ role: "user", content: "Use the supplied context" }],
			n: 2,
			documents: [{ content: "Official context", metadata: [{ key: "source", value: "handbook" }] }],
		});
		const ir = decodeOpenAIChatRequest(parsed);
		const wire = irToOpenAIChat(preprocess(ir, args(ir)), "jamba-large-1.7-2025-07", "ai21");
		expect(wire).toMatchObject({
			n: 2,
			documents: [{ content: "Official context", metadata: [{ key: "source", value: "handbook" }] }],
		});
	});

	it("uses a non-streaming upstream request for function tools and parses object arguments", async () => {
		const ir: IRChatRequest = {
			model: "ai21/jamba-large-1.7",
			stream: false,
			messages: [{ role: "user", content: [{ type: "text", text: "Check weather" }] }],
			maxTokens: 256,
			tools: [{ name: "get_weather", description: "Get weather", parameters: { type: "object" } }],
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.ai21.example/studio/v1/chat/completions",
			response: jsonResponse({
				id: "chat_ai21_1",
				model: "jamba-large-1.7-2025-07",
				choices: [{
					index: 0,
					message: { role: "assistant", content: "", tool_calls: [{ id: "call_1", type: "function", function: { name: "get_weather", arguments: { city: "London" } } }] },
					finish_reason: "stop",
				}],
				usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
			}),
		}]);
		const result = await executor(args(ir));
		mock.restore();
		expect(mock.calls[0]?.bodyJson).toMatchObject({ stream: false, max_tokens: 256 });
		expect(mock.calls[0]?.bodyJson?.stream_options).toBeUndefined();
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") {
			expect(result.ir?.choices[0]?.message.toolCalls?.[0]).toMatchObject({ name: "get_weather", arguments: '{"city":"London"}' });
		}
	});

	it("rejects unsupported AI21 combinations before dispatch", () => {
		const base: IRChatRequest = { model: "ai21/jamba-mini-2", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }] };
		expect(() => preprocess({ ...base, maxTokens: 4097 }, args(base))).toThrow("ai21_max_tokens_exceeds_4096");
		expect(() => preprocess({ ...base, stream: true, tools: [{ name: "f", parameters: {} }] }, args(base))).toThrow("ai21_tools_require_non_streaming");
		expect(() => preprocess({ ...base, messages: [{ role: "user", content: [{ type: "image", source: "url", data: "https://example.com/a.png" }] }] }, args(base))).toThrow("ai21_text_input_only");
	});
});
