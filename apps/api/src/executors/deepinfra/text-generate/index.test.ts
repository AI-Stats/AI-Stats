import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import { irToOpenAIChat, openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatRoute } from "@providers/openai-compatible/config";
import { DEEPINFRA_OPENAI_COMPAT_CONFIGS } from "@providers/deepinfra/config";
import { normalizeTextProviderServiceTier } from "@providers/textProfiles";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

function request(): IRChatRequest {
	return {
		model: "deepinfra/deepseek-ai/DeepSeek-R1",
		stream: false,
		messages: [{ role: "user", content: [{ type: "text", text: "Solve this" }] }],
		reasoning: { enabled: true, effort: "high" },
		serviceTier: "priority",
		promptCacheKey: "problem-set-v1",
	};
}

describe("DeepInfra current public text contract", () => {
	it("uses the OpenAI-compatible Chat endpoint and Bearer authentication", () => {
		expect(DEEPINFRA_OPENAI_COMPAT_CONFIGS.deepinfra.baseUrl).toBe("https://api.deepinfra.com");
		expect(resolveOpenAICompatRoute("deepinfra", "deepseek-ai/DeepSeek-R1")).toBe("chat");
		expect(openAICompatUrl("deepinfra", "/chat/completions")).toBe(
			"https://api.deepinfra.example/v1/openai/chat/completions",
		);
		expect(openAICompatHeaders("deepinfra", "secret").Authorization).toBe("Bearer secret");
	});

	it("maps reasoning, service tier, and prompt caching to documented fields", () => {
		const wire = irToOpenAIChat(request(), "deepseek-ai/DeepSeek-R1", "deepinfra");
		expect(wire).toMatchObject({
			reasoning_effort: "high",
			service_tier: "priority",
			prompt_cache_key: "problem-set-v1",
		});
	});

	it("normalizes the gateway standard tier to DeepInfra default", () => {
		expect(normalizeTextProviderServiceTier("deepinfra", "standard")).toBe("default");
		expect(normalizeTextProviderServiceTier("deepinfra", "priority")).toBe("priority");
	});

	it("forwards namespaced DeepInfra-only generation controls", () => {
		const ir = decodeOpenAIChatRequest({
			model: "deepinfra/deepseek-ai/DeepSeek-R1",
			messages: [{ role: "user", content: "Solve this" }],
			provider_options: {
				deepinfra: {
					fail_fast: true,
					min_p: 0.1,
					stop_token_ids: [2],
					continue_final_message: false,
					ignore_eos: true,
				},
			},
		} as any);
		const wire = irToOpenAIChat(ir, "deepseek-ai/DeepSeek-R1", "deepinfra");
		expect(wire).toMatchObject({
			fail_fast: true,
			min_p: 0.1,
			stop_token_ids: [2],
			continue_final_message: false,
			ignore_eos: true,
		});
	});

	it("maps disabling reasoning to reasoning_effort none", () => {
		const ir = request();
		ir.reasoning = { enabled: false };
		expect(irToOpenAIChat(ir, "deepseek-ai/DeepSeek-R1", "deepinfra").reasoning_effort).toBe("none");
	});

	it("preserves buffered reasoning_content and DeepInfra usage extensions", () => {
		const ir = openAIChatToIR({
			id: "chatcmpl_deepinfra",
			choices: [{
				index: 0,
				message: { content: "Answer", reasoning_content: "Working" },
				finish_reason: "stop",
			}],
			usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
			service_tier: "priority",
		}, "req_deepinfra", request().model, "deepinfra");

		expect(ir.choices[0].message.content).toEqual([
			{ type: "reasoning_text", text: "Working" },
			{ type: "text", text: "Answer" },
		]);
		expect(ir.usage).toMatchObject({ inputTokens: 12, outputTokens: 8, serviceTier: "priority" });
	});
});
