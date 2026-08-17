import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ GROQ_API_KEY: "gsk-test" } as any));
afterAll(teardownTestRuntime);

describe("Groq text generate contract", () => {
	it("maps vision, reasoning, tools, structured output, and supported sampling to Responses", async () => {
		const ir: IRChatRequest = {
			model: "qwen/qwen3.6-27b",
			stream: true,
			messages: [{ role: "user", content: [
				{ type: "text", text: "Read this image" },
				{ type: "image", source: "url", data: "https://example.com/chart.png", detail: "auto" },
			] }],
			maxTokens: 512,
			temperature: 0.4,
			topP: 0.9,
			topLogprobs: 3,
			reasoning: { effort: "low" },
			parallelToolCalls: true,
			tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
			toolChoice: { type: "function", name: "lookup" },
			responseFormat: { type: "json_schema", name: "answer", schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } },
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.groq.com/openai/v1/responses",
			response: new Response([
				"event: response.completed\n",
				`data: ${JSON.stringify({ type: "response.completed", response: { id: "resp_groq_1", object: "response", status: "completed", model: "qwen/qwen3.6-27b", output: [], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await executor({
			ir,
			requestId: "req_groq",
			workspaceId: "ws_groq",
			providerId: "groq",
			endpoint: "responses",
			protocol: "openai.responses",
			capability: "text.generate",
			providerModelSlug: "qwen/qwen3.6-27b",
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "qwen/qwen3.6-27b",
			stream: true,
			max_output_tokens: 512,
			temperature: 0.4,
			top_p: 0.9,
			top_logprobs: 3,
			reasoning: { effort: "low" },
			parallel_tool_calls: true,
			tool_choice: { type: "function", name: "lookup" },
			text: { format: { type: "json_schema", name: "answer" } },
		});
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		expect(mock.calls[0]?.bodyJson?.input[0]?.content[1]).toMatchObject({
			type: "input_image",
			image_url: "https://example.com/chart.png",
		});
	});
});
