import { describe, expect, it } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import {
	getTextProviderTemperatureMax,
	resolveTextProviderParamPolicyOverride,
} from "@providers/textProfiles";
import {
	irToOpenAIChat,
	openAIChatToIR,
} from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { preprocess } from "./index";

describe("Avian text contract", () => {
	it("advertises the documented parameters to capability routing", () => {
		for (const param of [
			"max_tokens",
			"temperature",
			"tools",
			"tool_choice",
			"parallel_tool_calls",
			"response_format",
		]) {
			expect(resolveTextProviderParamPolicyOverride({
				providerId: "avian",
				paramPathCandidates: [param],
			})).toBe(true);
		}
		expect(getTextProviderTemperatureMax("avian")).toBe(2);
	});

	it("preserves documented generation, tool, and JSON mode parameters", () => {
		const decoded = decodeOpenAIChatRequest(ChatCompletionsSchema.parse({
			model: "deepseek/deepseek-v3.2",
			messages: [{ role: "user", content: "Return JSON" }],
			temperature: 1.5,
			max_tokens: 256,
			tools: [{
				type: "function",
				function: {
					name: "lookup",
					parameters: { type: "object" },
				},
			}],
			tool_choice: "required",
			parallel_tool_calls: false,
			response_format: { type: "json_object" },
		}));
		const wire = irToOpenAIChat(
			preprocess(decoded, {
				capabilityParams: {
					params: [
						"max_tokens",
						"temperature",
						"tools",
						"tool_choice",
						"parallel_tool_calls",
						"response_format",
					],
				},
			} as any),
			"deepseek/deepseek-v3.2",
			"avian",
		);

		expect(wire).toMatchObject({
			model: "deepseek/deepseek-v3.2",
			temperature: 1.5,
			max_tokens: 256,
			tool_choice: "required",
			parallel_tool_calls: false,
			response_format: { type: "json_object" },
		});
		expect(wire.tools).toHaveLength(1);
	});

	it("normalizes documented response choices and usage into IR", () => {
		const response = openAIChatToIR({
			id: "chatcmpl-avian-1",
			object: "chat.completion",
			created: 1709000000,
			model: "deepseek/deepseek-v3.2",
			choices: [{
				index: 0,
				message: { role: "assistant", content: "Hello" },
				finish_reason: "stop",
			}],
			usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
		}, "request-avian", "deepseek/deepseek-v3.2", "avian");

		expect(response.choices[0]?.message.content).toEqual([
			{ type: "text", text: "Hello" },
		]);
		expect(response.usage).toMatchObject({
			inputTokens: 12,
			outputTokens: 9,
			totalTokens: 21,
		});
	});
});
