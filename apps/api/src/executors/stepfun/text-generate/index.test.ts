import { describe, expect, it } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import {
	irToOpenAIChat,
	openAIChatToIR,
} from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { irToOpenAIResponses } from "@executors/_shared/text-generate/openai-compat/transform";
import { preprocess } from "./index";

describe("StepFun text generation contract", () => {
	it("maps Chat multimodal input, audio output, structured output, tools, n, and reasoning", () => {
		const decoded = decodeOpenAIChatRequest(ChatCompletionsSchema.parse({
			model: "step-3.5-flash",
			messages: [{
				role: "user",
				content: [
					{ type: "text", text: "Analyze" },
					{ type: "image_url", image_url: { url: "https://example.com/i.png", detail: "high" } },
					{ type: "video_url", video_url: { url: "https://example.com/v.mp4" } },
					{ type: "input_audio", input_audio: { data: "data:audio/mpeg;base64,AAAA", format: "mp3" } },
				],
			}],
			max_tokens: 2048,
			temperature: 0.5,
			top_p: 0.9,
			n: 2,
			reasoning_effort: "high",
			reasoning_format: "deepseek-style",
			modalities: ["text", "audio"],
			audio: { voice: "wenrounansheng", format: "pcm" },
			tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }],
			response_format: { type: "json_object" },
		}));
		const wire = irToOpenAIChat(decoded, "step-3.5-flash", "stepfun");
		expect(wire).toMatchObject({
			max_tokens: 2048,
			temperature: 0.5,
			top_p: 0.9,
			n: 2,
			reasoning_effort: "high",
			reasoning_format: "deepseek-style",
			modalities: ["text", "audio"],
			audio: { voice: "wenrounansheng", format: "pcm" },
			response_format: { type: "json_object" },
		});
		expect(wire.messages[0].content).toHaveLength(4);
	});

	it("uses StepFun's exact OpenAI Responses shape for step-3.7-flash", () => {
		const wire = irToOpenAIResponses({
			model: "stepfun/step-3.7-flash",
			stream: true,
			messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
			maxTokens: 1024,
			reasoning: { effort: "medium" },
			responseFormat: { type: "json_schema", name: "answer", schema: { type: "object" } },
		} as any, "step-3.7-flash", "stepfun");
		expect(wire).toMatchObject({
			model: "step-3.7-flash",
			input: [{ type: "message", role: "user" }],
			max_output_tokens: 1024,
			reasoning: { effort: "medium" },
			text: { format: { type: "json_schema", name: "answer", strict: false, schema: { type: "object" } } },
		});
		expect(wire.input_items).toBeUndefined();
	});

	it("rejects Chat-only parameters when step-3.7-flash is routed to Responses", () => {
		const ir = {
			model: "stepfun/step-3.7-flash",
			stream: false,
			messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
			stop: ["done"],
		} as any;
		expect(() => preprocess(ir, {
			providerModelSlug: "step-3.7-flash",
			capabilityParams: null,
		} as any)).toThrow("stepfun_responses_unsupported_stop");
	});

	it("normalizes StepFun reasoning and detailed usage", () => {
		const response = openAIChatToIR({
			id: "chat-stepfun",
			model: "step-3.5-flash",
			choices: [{ index: 0, message: { role: "assistant", reasoning: "work", content: "answer" }, finish_reason: "stop" }],
			usage: {
				prompt_tokens: 10, completion_tokens: 5, total_tokens: 15,
				prompt_tokens_details: { cached_tokens: 3 },
				completion_tokens_details: { reasoning_tokens: 2 },
			},
		}, "req-stepfun", "step-3.5-flash", "stepfun");
		expect(response.choices[0].message.content).toEqual([
			{ type: "reasoning_text", text: "work" },
			{ type: "text", text: "answer" },
		]);
		expect(response.usage).toMatchObject({ cachedInputTokens: 3, reasoningTokens: 2 });
	});

	it("replays assistant reasoning for StepFun tool continuation", () => {
		const wire = irToOpenAIChat({
			model: "step-3.5-flash",
			stream: false,
			messages: [{
				role: "assistant",
				content: [
					{ type: "reasoning_text", text: "prior reasoning" },
					{ type: "text", text: "calling tool" },
				],
				toolCalls: [{ id: "call_1", name: "lookup", arguments: "{}" }],
			}],
		} as any, "step-3.5-flash", "stepfun");
		expect(wire.messages[0].reasoning_content).toBe("prior reasoning");
	});
});
