import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { irToOpenAIChat, openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { cherryPickIRParams } from "@executors/_shared/text-generate/shared";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatRoute } from "@providers/openai-compatible/config";
import { normalizeTextProviderServiceTier } from "@providers/textProfiles";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ MORPH_API_KEY: "morph-test-key" } as any));
afterAll(() => teardownTestRuntime());

function request(): IRChatRequest {
	return {
		model: "z-ai/glm-5.2",
		stream: false,
		messages: [{ role: "user", content: [{ type: "text", text: "Return JSON and call the tool if needed" }] }],
		maxTokens: 256,
		temperature: 0.2,
		tools: [{ type: "function", name: "lookup", parameters: { type: "object", properties: {} } }],
		responseFormat: {
			type: "json_schema",
			name: "answer",
			schema: { type: "object", properties: { answer: { type: "string" } } },
		},
		reasoning: { effort: "high" },
		serviceTier: "standby",
		logprobs: true,
		topLogprobs: 3,
	};
}

describe("Morph current OpenAI-compatible text contract", () => {
	it("uses the documented Chat endpoint and Bearer authentication", () => {
		expect(resolveOpenAICompatRoute("morph", "morph-glm52-744b")).toBe("chat");
		expect(openAICompatUrl("morph", "/chat/completions")).toBe("https://api.morphllm.com/v1/chat/completions");
		expect(openAICompatHeaders("morph", "secret").Authorization).toBe("Bearer secret");
		expect(normalizeTextProviderServiceTier("morph", "standard")).toBe("default");
		expect(normalizeTextProviderServiceTier("morph", "flex")).toBe("standby");
	});

	it("preserves structured outputs through the catalogue alias and emits Morph reasoning", () => {
		const filtered = cherryPickIRParams(request(), {
			capabilityParams: {
				max_tokens: true,
				temperature: true,
				tools: true,
				structured_outputs: true,
				include_reasoning: true,
				logprobs: true,
				top_logprobs: true,
				service_tier: true,
			},
		} as any);
		const wire = irToOpenAIChat(filtered, "morph-glm52-744b", "morph");

		expect(wire).toMatchObject({
			model: "morph-glm52-744b",
			max_tokens: 256,
			temperature: 0.2,
			reasoning: { effort: "high" },
			response_format: { type: "json_schema", json_schema: { name: "answer", strict: true } },
			service_tier: "standby",
			logprobs: true,
			top_logprobs: 3,
		});
		expect(wire.tools[0].function.name).toBe("lookup");
		expect(wire.reasoning_effort).toBeUndefined();
	});

	it("normalizes tool calls, cached usage, reasoning usage, and the served tier", () => {
		const ir = openAIChatToIR({
			id: "chatcmpl_morph",
			model: "morph-glm52-744b",
			service_tier: "standby",
			choices: [{
				index: 0,
				message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup", arguments: "{}" } }] },
				finish_reason: "tool_calls",
			}],
			usage: {
				prompt_tokens: 20,
				completion_tokens: 8,
				total_tokens: 28,
				prompt_tokens_details: { cached_tokens: 6 },
				completion_tokens_details: { reasoning_tokens: 3 },
			},
		}, "req_morph", request().model, "morph");

		expect(ir.choices[0].message.toolCalls?.[0]).toMatchObject({ id: "call_1", name: "lookup", arguments: "{}" });
		expect(ir.usage).toMatchObject({
			inputTokens: 20,
			outputTokens: 8,
			cachedInputTokens: 6,
			reasoningTokens: 3,
			serviceTier: "standby",
		});
	});

	it("streams standard Chat chunks and requests terminal usage", async () => {
		const mock = installFetchMock([{
			match: (url) => url === "https://api.morphllm.com/v1/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chatcmpl_morph_stream", object: "chat.completion.chunk", model: "morph-kimik3", choices: [{ index: 0, delta: { role: "assistant", content: "Hi" }, finish_reason: null }] })}\n\n`,
				`data: ${JSON.stringify({ id: "chatcmpl_morph_stream", object: "chat.completion.chunk", model: "morph-kimik3", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const ir = request();
		ir.model = "moonshotai/kimi-k3";
		ir.stream = true;
		const result = await executor({
			ir,
			requestId: "req_morph_stream",
			workspaceId: "ws_morph",
			providerId: "morph",
			endpoint: "chat.completions",
			protocol: "openai.chat",
			capability: "text.generate",
			providerModelSlug: "morph-kimik3",
			capabilityParams: {
				max_tokens: true, temperature: true, tools: true, structured_outputs: true,
				include_reasoning: true, logprobs: true, top_logprobs: true,
			},
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer morph-test-key");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "morph-kimik3",
			stream: true,
			stream_options: { include_usage: true },
			reasoning: { effort: "high" },
			response_format: { type: "json_schema" },
		});
	});
});
