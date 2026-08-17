import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import type { ExecutorExecuteArgs } from "@executors/types";
import { openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ FEATHERLESS_API_KEY: "fl-test-key" } as any));
afterAll(teardownTestRuntime);

describe("Featherless text generate contract", () => {
	it("preserves documented vision, sampling, vLLM, tools, JSON, and reasoning controls", async () => {
		const ir = decodeOpenAIChatRequest(ChatCompletionsSchema.parse({
			model: "Qwen/Qwen3-32B",
			messages: [{ role: "user", content: [
				{ type: "text", text: "Inspect this" },
				{ type: "image_url", image_url: { url: "https://example.com/image.png" } },
			] }],
			stream: true,
			max_tokens: 256,
			temperature: 0.4,
			top_p: 0.9,
			top_k: 40,
			min_p: 0.05,
			repetition_penalty: 1.1,
			stop_token_ids: [2],
			include_stop_str_in_output: true,
			min_tokens: 8,
			chat_template_kwargs: { enable_thinking: false, preserve_thinking: true },
			tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }],
			response_format: { type: "json_object" },
		}));
		const mock = installFetchMock([{
			match: (url) => url === "https://api.featherless.ai/v1/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chat_fl_1", object: "chat.completion.chunk", model: "Qwen/Qwen3-32B", choices: [{ index: 0, delta: { content: "{}" }, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 2, total_tokens: 13 } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await executor({
			ir,
			requestId: "req_fl",
			workspaceId: "ws_fl",
			providerId: "featherless",
			endpoint: "chat.completions",
			protocol: "openai.chat.completions",
			capability: "text.generate",
			providerModelSlug: "Qwen/Qwen3-32B",
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "Qwen/Qwen3-32B",
			max_tokens: 256,
			top_k: 40,
			min_p: 0.05,
			repetition_penalty: 1.1,
			stop_token_ids: [2],
			include_stop_str_in_output: true,
			min_tokens: 8,
			chat_template_kwargs: { enable_thinking: false, preserve_thinking: true },
			response_format: { type: "json_object" },
		});
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		expect(mock.calls[0]?.bodyJson?.messages[0]?.content[1]).toMatchObject({ type: "image_url" });
	});

	it("normalizes reasoning_content and token usage into IR", () => {
		const response = openAIChatToIR({
			id: "chat_fl_2",
			model: "Qwen/Qwen3-32B",
			choices: [{ index: 0, message: { role: "assistant", reasoning_content: "Think", content: "Answer" }, finish_reason: "stop" }],
			usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
		}, "req_fl", "Qwen/Qwen3-32B", "featherless");

		expect(response.choices[0]?.message.content).toEqual([
			{ type: "reasoning_text", text: "Think" },
			{ type: "text", text: "Answer" },
		]);
		expect(response.usage).toMatchObject({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
	});
});
