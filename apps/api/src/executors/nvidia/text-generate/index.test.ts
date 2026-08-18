import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";
import { irToOpenAIChat } from "@executors/_shared/text-generate/openai-compat/transform-chat";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

beforeAll(() => setupRuntimeFromEnv({ NVIDIA_API_KEY: "nvapi-test" } as any));
afterAll(teardownTestRuntime);

describe("NVIDIA NIM text generation contract", () => {
	it("maps the Omni model's documented reasoning token budget", () => {
		const request = irToOpenAIChat({
			model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
			stream: false,
			messages: [{ role: "user", content: [{ type: "text", text: "Describe the video" }] }],
			reasoning: { maxTokens: 16_384 },
		}, "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "nvidia", null);
		expect(request.reasoning_budget).toBe(16_384);
	});

	it("preserves GPT-OSS reasoning, tools, structured output, streaming, and usage", async () => {
		const ir: IRChatRequest = {
			model: "openai/gpt-oss-120b",
			stream: true,
			messages: [{ role: "user", content: [{ type: "text", text: "Solve this" }] }],
			maxTokens: 256,
			temperature: 0.4,
			topP: 0.9,
			reasoning: { effort: "medium" },
			tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
			toolChoice: "auto",
			responseFormat: { type: "json_schema", name: "answer", schema: { type: "object" } },
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://integrate.api.nvidia.com/v1/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chatcmpl-nv", object: "chat.completion.chunk", model: "openai/gpt-oss-120b", choices: [{ index: 0, delta: { role: "assistant", reasoning_content: "Reason" }, finish_reason: null }] })}\n\n`,
				`data: ${JSON.stringify({ id: "chatcmpl-nv", object: "chat.completion.chunk", model: "openai/gpt-oss-120b", choices: [{ index: 0, delta: { content: "Done" }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
		}]);
		const result = await executor({
			ir,
			requestId: "req_nvidia",
			workspaceId: "ws_nvidia",
			providerId: "nvidia",
			endpoint: "responses",
			protocol: "openai.responses",
			capability: "text.generate",
			providerModelSlug: "openai/gpt-oss-120b",
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		expect(result.kind).toBe("stream");
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer nvapi-test");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "openai/gpt-oss-120b",
			stream: true,
			stream_options: { include_usage: true },
			max_tokens: 256,
			temperature: 0.4,
			top_p: 0.9,
			reasoning_effort: "medium",
			tool_choice: "auto",
			response_format: { type: "json_schema" },
		});
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		mock.restore();
	});
});
