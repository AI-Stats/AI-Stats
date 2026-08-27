import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat, openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { MORPHEUS_OPENAI_COMPAT_CONFIGS } from "@providers/morpheus/config";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatRoute } from "@providers/openai-compatible/config";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ MORPHEUS_API_KEY: "morpheus-test-key" } as any));
afterAll(() => teardownTestRuntime());

function request(): IRChatRequest {
	return {
		model: "z-ai/glm-5.2",
		stream: true,
		messages: [{ role: "user", content: [{ type: "text", text: "Use the tool" }] }],
		maxTokens: 256,
		temperature: 0.2,
		topP: 0.9,
		frequencyPenalty: 0.1,
		presencePenalty: -0.1,
		stop: ["END"],
		tools: [{ type: "function", name: "lookup", parameters: { type: "object", properties: {} } }],
		toolChoice: "auto",
		streamOptions: { include_usage: true },
		vendor: { morpheus: { n: 2, session_id: "session-123" } },
	};
}

describe("Morpheus current Chat contract", () => {
	it("uses the documented versioned endpoint and Bearer authentication", () => {
		expect(MORPHEUS_OPENAI_COMPAT_CONFIGS.morpheus.baseUrl).toBe("https://api.mor.org");
		expect(MORPHEUS_OPENAI_COMPAT_CONFIGS.morpheus.pathPrefix).toBe("/api/v1");
		expect(resolveOpenAICompatRoute("morpheus", "glm-5.2")).toBe("chat");
		expect(openAICompatUrl("morpheus", "/chat/completions")).toBe("https://api.mor.org/api/v1/chat/completions");
		expect(openAICompatHeaders("morpheus", "secret").Authorization).toBe("Bearer secret");
	});

	it("preserves the documented sampling, tool, multi-choice, and session fields", () => {
		const decoded = decodeOpenAIChatRequest({
			model: "glm-5.2",
			messages: [{ role: "user", content: "hello" }],
			n: 2,
			session_id: "session-123",
		} as any);
		expect((decoded.vendor as any)?.morpheus).toEqual({ n: 2, session_id: "session-123" });

		const wire = irToOpenAIChat(request(), "glm-5.2", "morpheus");
		expect(wire).toMatchObject({
			model: "glm-5.2",
			stream: true,
			stream_options: { include_usage: true },
			max_tokens: 256,
			temperature: 0.2,
			top_p: 0.9,
			frequency_penalty: 0.1,
			presence_penalty: -0.1,
			stop: ["END"],
			n: 2,
			session_id: "session-123",
			tool_choice: "auto",
		});
		expect(wire.tools[0]).toMatchObject({ type: "function", function: { name: "lookup" } });
	});

	it("normalizes standard choices, tool calls, finish reasons, and usage", () => {
		const ir = openAIChatToIR({
			id: "chatcmpl_morpheus",
			model: "glm-5.2",
			choices: [{
				index: 0,
				message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup", arguments: "{}" } }] },
				finish_reason: "tool_calls",
			}],
			usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
		}, "req_morpheus", request().model, "morpheus");

		expect(ir.choices[0].finishReason).toBe("tool_calls");
		expect(ir.choices[0].message.toolCalls?.[0]).toMatchObject({ id: "call_1", name: "lookup", arguments: "{}" });
		expect(ir.usage).toMatchObject({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
	});
});
