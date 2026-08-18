import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

beforeAll(() => setupRuntimeFromEnv({ INFERENCE_API_KEY: "inf-test-key" } as any));
afterAll(teardownTestRuntime);

describe("Inference.net text generate contract", () => {
	it("maps vision, reasoning, tools, sampling, and structured output to Chat Completions", async () => {
		const ir: IRChatRequest = {
			model: "google/gemma-3-27b-instruct/bf-16",
			stream: true,
			messages: [{ role: "user", content: [
				{ type: "image", source: "data", data: "aW1hZ2U=", mimeType: "image/png" },
				{ type: "text", text: "Describe this image" },
			] }],
			maxTokens: 512,
			temperature: 0.4,
			topP: 0.9,
			frequencyPenalty: 0.1,
			presencePenalty: 0.2,
			reasoning: { effort: "high" },
			tools: [{ type: "function", name: "lookup", parameters: { type: "object" }, strict: true }],
			responseFormat: { type: "json_schema", name: "answer", strict: true, schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } },
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.inference.net/v1/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chat_inf_1", object: "chat.completion.chunk", model: "google/gemma-3-27b-instruct/bf-16", choices: [{ index: 0, delta: { content: "{}" }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await executor({
			ir,
			requestId: "req_inf",
			workspaceId: "ws_inf",
			providerId: "inference-net",
			endpoint: "chat.completions",
			protocol: "openai.chat.completions",
			capability: "text.generate",
			providerModelSlug: "google/gemma-3-27b-instruct/bf-16",
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "google/gemma-3-27b-instruct/bf-16",
			stream: true,
			max_tokens: 512,
			temperature: 0.4,
			top_p: 0.9,
			frequency_penalty: 0.1,
			presence_penalty: 0.2,
			reasoning_effort: "high",
			response_format: { type: "json_schema", json_schema: { name: "answer", strict: true } },
		});
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		expect(mock.calls[0]?.bodyJson?.messages[0]?.content[0]).toMatchObject({
			type: "image_url",
			image_url: { url: "data:image/png;base64,aW1hZ2U=" },
		});
	});

	it("normalizes reasoning text and usage into IR", () => {
		const response = openAIChatToIR({
			id: "chat_inf_2",
			choices: [{ index: 0, message: { role: "assistant", reasoning_content: "Think", content: "Answer" }, finish_reason: "stop" }],
			usage: { prompt_tokens: 8, completion_tokens: 6, total_tokens: 14, completion_tokens_details: { reasoning_tokens: 3 } },
		}, "req_inf", "glm-5.2", "inference-net");

		expect(response.choices[0]?.message.content).toEqual([
			{ type: "reasoning_text", text: "Think" },
			{ type: "text", text: "Answer" },
		]);
		expect(response.usage).toMatchObject({ inputTokens: 8, outputTokens: 6, reasoningTokens: 3 });
	});
});
