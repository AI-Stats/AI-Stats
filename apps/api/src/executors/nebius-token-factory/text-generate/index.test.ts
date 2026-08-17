import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./index";

beforeAll(() => setupRuntimeFromEnv({ NEBIUS_API_KEY: "nebius-test" } as any));
afterAll(teardownTestRuntime);

function args(model: string): ExecutorExecuteArgs {
	const ir: IRChatRequest = {
		model: `nebius-token-factory/${model}`,
		stream: true,
		messages: [{ role: "user", content: [{ type: "text", text: "Solve this" }] }],
		maxTokens: 256,
		temperature: 0.4,
		reasoning: { enabled: true, effort: "high" },
		tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
		responseFormat: {
			type: "json_schema",
			name: "answer",
			schema: { type: "object", properties: { answer: { type: "string" } } },
		},
	};
	return {
		ir,
		requestId: "req_nebius",
		workspaceId: "ws_nebius",
		providerId: "nebius-token-factory",
		endpoint: "responses",
		protocol: "openai.responses",
		capability: "text.generate",
		providerModelSlug: model,
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

describe("Nebius Token Factory text generation", () => {
	it("uses native Responses for models that advertise responses_api", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/responses"),
			response: new Response("data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await execute(args("Qwen/Qwen3-32B"));
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "Qwen/Qwen3-32B",
			stream: true,
			max_output_tokens: 256,
			temperature: 0.4,
			reasoning: { effort: "high" },
			text: { format: { type: "json_schema", name: "answer" } },
		});
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
	});

	it("falls back to Chat for models not marked responses_api", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/chat/completions"),
			response: new Response("data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await execute(args("nvidia/nemotron-3-super-120b-a12b"));
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "nvidia/nemotron-3-super-120b-a12b",
			stream: true,
			stream_options: { include_usage: true },
			max_tokens: 256,
			temperature: 0.4,
			reasoning_effort: "high",
			response_format: { type: "json_schema", json_schema: { name: "answer" } },
		});
	});
});
