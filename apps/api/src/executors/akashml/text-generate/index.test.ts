import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { executor, preprocess } from "./index";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

function args(ir: IRChatRequest): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_akashml_contract",
		workspaceId: "ws_akashml_contract",
		providerId: "akashml",
		endpoint: "chat.completions",
		protocol: "openai.chat.completions",
		capability: "text.generate",
		providerModelSlug: "openai/gpt-oss-120b",
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

beforeAll(setupTestRuntime);
afterAll(teardownTestRuntime);

describe("AkashML text generate contract", () => {
	it("preserves documented n and gpt-oss reasoning effort mappings", () => {
		const decoded = decodeOpenAIChatRequest(ChatCompletionsSchema.parse({
			model: "openai/gpt-oss-120b",
			messages: [{ role: "user", content: "hello" }],
			n: 3,
			reasoning_effort: "xhigh",
		}));
		const processed = preprocess(decoded, args(decoded));
		const wire = irToOpenAIChat(processed, "openai/gpt-oss-120b", "akashml");
		expect(wire).toMatchObject({ n: 3, reasoning_effort: "high" });
		expect(() => preprocess({ ...decoded, reasoning: { effort: "none" } }, args(decoded))).toThrow("akashml_gpt_oss_reasoning_cannot_be_disabled");
	});

	it("uses Akash chat SSE and captures Inference-Id", async () => {
		const ir: IRChatRequest = {
			model: "google/gemma-4-31b",
			stream: false,
			messages: [{ role: "user", content: [{ type: "image", source: "url", data: "https://example.com/cat.png" }, { type: "text", text: "Describe" }] }],
			responseFormat: { type: "json_schema", name: "answer", schema: { type: "object", properties: { answer: { type: "string" } } } },
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.akashml.example/v1/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chat_akash_1", model: "google/gemma-4-31B-it", choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] })}\n\n`,
				`data: ${JSON.stringify({ id: "chat_akash_1", model: "google/gemma-4-31B-it", choices: [{ index: 0, delta: { content: '{"answer":"cat"}' }, finish_reason: null }] })}\n\n`,
				`data: ${JSON.stringify({ id: "chat_akash_1", model: "google/gemma-4-31B-it", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream", "Inference-Id": "inf_akash_1" } }),
		}]);
		const result = await executor(args(ir));
		mock.restore();
		expect(mock.calls[0]?.bodyJson).toMatchObject({ stream: true, response_format: { type: "json_schema" } });
		expect(mock.calls[0]?.bodyJson?.messages[0]?.content[0]).toMatchObject({ type: "image_url" });
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") expect(result.bill.upstream_id).toBe("inf_akash_1");
	});
});
