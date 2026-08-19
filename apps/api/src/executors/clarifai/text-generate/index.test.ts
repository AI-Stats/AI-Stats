import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import { decodeOpenAIChatRequest } from "../../../protocols/openai-chat/decode";
import { irToOpenAIChat, openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { irToOpenAIResponses } from "@executors/_shared/text-generate/openai-compat/transform";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatRoute } from "@providers/openai-compatible/config";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

function request(): IRChatRequest {
	return {
		model: "openai/chat-completion/models/gpt-oss-120b",
		stream: false,
		messages: [{
			role: "user",
			content: [
				{ type: "text", text: "Describe this" },
				{ type: "image", source: "url", data: "https://samples.clarifai.com/cat1.jpeg" },
			],
		}],
		maxTokens: 100,
		responseFormat: {
			type: "json_schema",
			name: "answer",
			schema: { type: "object", properties: { answer: { type: "string" } } },
		},
	};
}

describe("Clarifai current OpenAI-compatible text contract", () => {
	it("uses the official endpoint, Responses route, and PAT Key auth", () => {
		expect(resolveOpenAICompatRoute("clarifai", request().model)).toBe("responses");
		expect(openAICompatUrl("clarifai", "/responses")).toBe("https://api.clarifai.com/v2/ext/openai/v1/responses");
		expect(openAICompatHeaders("clarifai", "pat-secret").Authorization).toBe("Key pat-secret");
	});

	it("uses the official OpenAI Responses shape", () => {
		const wire = irToOpenAIResponses(request(), request().model, "clarifai");
		expect(wire.input_items).toBeUndefined();
		expect(wire.input[0].content[1]).toEqual({
			type: "input_image",
			image_url: "https://samples.clarifai.com/cat1.jpeg",
		});
		expect(wire.max_output_tokens).toBe(100);
		expect(wire.text.format.type).toBe("json_schema");
	});

	it("uses max_completion_tokens and preserves structured output on Chat", () => {
		const wire = irToOpenAIChat(request(), request().model, "clarifai");
		expect(wire.max_completion_tokens).toBe(100);
		expect(wire.max_tokens).toBeUndefined();
		expect(wire.response_format.type).toBe("json_schema");
	});

	it("preserves Clarifai MCP server extensions through the IR", () => {
		const ir = decodeOpenAIChatRequest({
			model: request().model,
			messages: [{ role: "user", content: "Weather?" }],
			mcp_servers: ["https://clarifai.com/clarifai/mcp/models/weather-mcp-server"],
		} as any);
		const wire = irToOpenAIChat(ir, ir.model, "clarifai");

		expect(wire.mcp_servers).toEqual([
			"https://clarifai.com/clarifai/mcp/models/weather-mcp-server",
		]);
	});

	it("normalizes tool calls and token usage", () => {
		const ir = openAIChatToIR({
			id: "chatcmpl_clarifai",
			choices: [{
				index: 0,
				message: {
					content: null,
					tool_calls: [{ id: "call_1", type: "function", function: { name: "weather", arguments: "{}" } }],
				},
				finish_reason: "tool_calls",
			}],
			usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
		}, "req_clarifai", request().model, "clarifai");

		expect(ir.choices[0].finishReason).toBe("tool_calls");
		expect(ir.choices[0].message.toolCalls?.[0]).toMatchObject({ id: "call_1", name: "weather" });
		expect(ir.usage).toMatchObject({ inputTokens: 8, outputTokens: 3, totalTokens: 11 });
	});
});
