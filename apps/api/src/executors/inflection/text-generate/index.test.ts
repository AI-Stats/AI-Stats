import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import { irToOpenAIChat, openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { INFLECTION_OPENAI_COMPAT_CONFIGS } from "@providers/inflection/config";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatRoute } from "@providers/openai-compatible/config";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

function request(): IRChatRequest {
	return {
		model: "inflection/inflection-3-productivity",
		stream: true,
		messages: [{ role: "user", content: [{ type: "text", text: "Return JSON" }] }],
		maxTokens: 512,
		temperature: 0.4,
		tools: [{ name: "lookup", type: "function", parameters: { type: "object", properties: {} } }],
		toolChoice: "auto",
		parallelToolCalls: true,
		responseFormat: { type: "json_object" },
		streamOptions: { include_usage: true },
	};
}

describe("Inflection current Chat contract", () => {
	it("uses the documented endpoint and Bearer auth", () => {
		expect(INFLECTION_OPENAI_COMPAT_CONFIGS.inflection.baseUrl).toBe("https://api.inflection.ai");
		expect(resolveOpenAICompatRoute("inflection", "inflection_3_productivity")).toBe("chat");
		expect(openAICompatUrl("inflection", "/chat/completions")).toBe(
			"https://api.inflection.example/v1/chat/completions",
		);
		expect(openAICompatHeaders("inflection", "secret").Authorization).toBe("Bearer secret");
	});

	it("maps documented tools, JSON output, and stream usage controls", () => {
		const wire = irToOpenAIChat(request(), "inflection_3_productivity", "inflection");
		expect(wire).toMatchObject({
			model: "inflection_3_productivity",
			max_tokens: 512,
			stream: true,
			stream_options: { include_usage: true },
			tool_choice: "auto",
			parallel_tool_calls: true,
			response_format: { type: "json_object" },
		});
		expect(wire.tools[0]).toMatchObject({ type: "function", function: { name: "lookup" } });
	});

	it("normalizes standard completion usage and tool calls", () => {
		const ir = openAIChatToIR({
			id: "chatcmpl_inflection",
			model: "Pi-3.1",
			choices: [{
				index: 0,
				message: {
					role: "assistant",
					content: null,
					tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup", arguments: "{}" } }],
				},
				finish_reason: "tool_calls",
			}],
			usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
		}, "req_inflection", request().model, "inflection");
		expect(ir.choices[0].finishReason).toBe("tool_calls");
		expect(ir.choices[0].message.toolCalls?.[0]).toMatchObject({ id: "call_1", name: "lookup" });
		expect(ir.usage).toMatchObject({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
	});
});
