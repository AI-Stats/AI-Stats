import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ NOVITA_API_KEY: "novita-test" } as any));
afterAll(teardownTestRuntime);

describe.each(["novita", "novitaai"])("%s text generation contract", (providerId) => {
	it("maps the IR to Novita Chat and normalizes reasoning and usage back to Responses", async () => {
		const ir: IRChatRequest = {
			model: "deepseek/deepseek-v3.1",
			stream: true,
			messages: [
				{ role: "developer", content: [{ type: "text", text: "Be precise." }] },
				{ role: "user", content: [{ type: "text", text: "Answer" }] },
			],
			maxTokens: 128,
			temperature: 0.3,
			topP: 0.9,
			topK: 40,
			minP: 0.05,
			repetitionPenalty: 1.1,
			reasoning: { enabled: true },
			tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
			responseFormat: { type: "json_schema", name: "answer", schema: { type: "object" } },
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.novita.ai/openai/v1/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chatcmpl-novita", object: "chat.completion.chunk", model: ir.model, choices: [{ index: 0, delta: { role: "assistant", reasoning_content: "Think" }, finish_reason: null }] })}\n\n`,
				`data: ${JSON.stringify({ id: "chatcmpl-novita", object: "chat.completion.chunk", model: ir.model, choices: [{ index: 0, delta: { content: "Done" }, finish_reason: "stop" }], usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await executor({
			ir,
			requestId: `req_${providerId}`,
			workspaceId: "ws_novita",
			providerId,
			endpoint: "responses",
			protocol: "openai.responses",
			capability: "text.generate",
			providerModelSlug: ir.model,
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer novita-test");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "deepseek/deepseek-v3.1",
			max_tokens: 128,
			temperature: 0.3,
			top_p: 0.9,
			top_k: 40,
			min_p: 0.05,
			repetition_penalty: 1.1,
			enable_thinking: true,
			stream: true,
			stream_options: { include_usage: true },
			response_format: { type: "json_schema" },
		});
		expect(mock.calls[0]?.bodyJson?.messages[0]?.role).toBe("system");
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		mock.restore();
	});
});
