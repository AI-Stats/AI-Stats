import { describe, expect, it } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import {
	irToOpenAIChat,
	openAIChatToIR,
} from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { preprocess } from "./index";

describe("SiliconFlow text generation contract", () => {
	it("preserves documented sampling, generation count, tools, vision, and thinking controls", () => {
		const decoded = decodeOpenAIChatRequest(ChatCompletionsSchema.parse({
			model: "Qwen/Qwen3-32B",
			messages: [{
				role: "user",
				content: [
					{ type: "text", text: "Describe this image" },
					{ type: "image_url", image_url: { url: "https://example.com/image.png", detail: "high" } },
				],
			}],
			max_tokens: 2048,
			top_p: 0.7,
			top_k: 50,
			min_p: 0.05,
			n: 2,
			tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }],
		}));
		decoded.reasoning = { enabled: false, maxTokens: 4096 };
		const wire = irToOpenAIChat(
			preprocess(decoded, { capabilityParams: null } as any),
			"Qwen/Qwen3-32B",
			"siliconflow",
		);

		expect(wire).toMatchObject({
			model: "Qwen/Qwen3-32B",
			max_tokens: 2048,
			top_p: 0.7,
			top_k: 50,
			min_p: 0.05,
			n: 2,
			enable_thinking: false,
			thinking_budget: 4096,
		});
		expect(wire.messages[0].content[1]).toEqual({
			type: "image_url",
			image_url: { url: "https://example.com/image.png", detail: "high" },
		});
	});

	it("normalizes reasoning and detailed token usage", () => {
		const response = openAIChatToIR({
			id: "chatcmpl-siliconflow",
			model: "Qwen/Qwen3-32B",
			choices: [{
				index: 0,
				message: { role: "assistant", reasoning_content: "working", content: "answer" },
				finish_reason: "stop",
			}],
			usage: {
				prompt_tokens: 10,
				completion_tokens: 5,
				total_tokens: 15,
				prompt_tokens_details: { cached_tokens: 3 },
				completion_tokens_details: { reasoning_tokens: 2 },
			},
		}, "request-siliconflow", "Qwen/Qwen3-32B", "siliconflow");

		expect(response.choices[0]?.message.content).toEqual([
			{ type: "reasoning_text", text: "working" },
			{ type: "text", text: "answer" },
		]);
		expect(response.usage).toMatchObject({
			inputTokens: 10,
			outputTokens: 5,
			totalTokens: 15,
			cachedInputTokens: 3,
			reasoningTokens: 2,
		});
	});
});
