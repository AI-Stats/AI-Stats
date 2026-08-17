import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatRoute } from "@providers/openai-compatible/config";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ OVH_AI_ENDPOINTS_ACCESS_TOKEN: "ovh-test-key" } as any));
afterAll(teardownTestRuntime);

describe("OVHcloud current text generation contract", () => {
	it("uses the documented global endpoint, Bearer auth, and native Responses API", () => {
		expect(resolveOpenAICompatRoute("ovhcloud", "Qwen3.5-9B")).toBe("responses");
		expect(openAICompatUrl("ovhcloud", "/responses")).toBe("https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/responses");
		expect(openAICompatHeaders("ovhcloud", "secret").Authorization).toBe("Bearer secret");
	});

	it("preserves vision, reasoning, tools, structured output, streaming, and usage", async () => {
		const ir: IRChatRequest = {
			model: "qwen/qwen3.5-9b",
			stream: true,
			messages: [{ role: "user", content: [
				{ type: "text", text: "Describe the chart and call the tool" },
				{ type: "image", source: "url", data: "https://example.com/chart.png", detail: "auto" },
			] }],
			maxTokens: 512,
			temperature: 0.4,
			topP: 0.9,
			reasoning: { effort: "high" },
			parallelToolCalls: true,
			tools: [{ type: "function", name: "lookup", parameters: { type: "object", properties: {} } }],
			toolChoice: "auto",
			responseFormat: {
				type: "json_schema",
				name: "answer",
				schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
			},
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/responses",
			response: new Response([
				"event: response.completed\n",
				`data: ${JSON.stringify({ type: "response.completed", response: { id: "resp_ovh_1", object: "response", status: "completed", model: "Qwen3.5-9B", output: [], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { headers: { "Content-Type": "text/event-stream", "x-request-id": "ovh-request-1" } }),
		}]);

		const result = await executor({
			ir,
			requestId: "req_ovh_text",
			workspaceId: "ws_ovh",
			providerId: "ovhcloud",
			endpoint: "responses",
			protocol: "openai.responses",
			capability: "text.generate",
			providerModelSlug: "Qwen3.5-9B",
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer ovh-test-key");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "Qwen3.5-9B",
			stream: true,
			max_output_tokens: 512,
			temperature: 0.4,
			top_p: 0.9,
			reasoning: { effort: "high" },
			parallel_tool_calls: true,
			tool_choice: "auto",
			text: { format: { type: "json_schema", name: "answer" } },
		});
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		expect(mock.calls[0]?.bodyJson?.input[0]?.content[1]).toMatchObject({
			type: "input_image",
			image_url: "https://example.com/chart.png",
		});
	});
});
