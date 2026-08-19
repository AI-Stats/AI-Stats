import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { executor } from "./index";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

function args(ir: IRChatRequest): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_crusoe_contract",
		workspaceId: "ws_crusoe_contract",
		providerId: "crusoe",
		endpoint: "chat.completions",
		protocol: "openai.chat.completions",
		capability: "text.generate",
		providerModelSlug: "meta-llama/Llama-3.3-70B-Instruct",
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

beforeAll(() => setupRuntimeFromEnv({ CRUSOE_API_KEY: "crusoe-test-key" } as any));
afterAll(teardownTestRuntime);

describe("Crusoe text generate contract", () => {
	it("sends OpenAI Chat Completions to the documented inference endpoint", async () => {
		const ir: IRChatRequest = {
			model: "meta-llama/Llama-3.3-70B-Instruct",
			stream: true,
			messages: [
				{ role: "system", content: [{ type: "text", text: "Be concise." }] },
				{ role: "user", content: [{ type: "text", text: "Who is Robinson Crusoe?" }] },
			],
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.inference.crusoecloud.com/v1/chat/completions",
			response: new Response([
				`data: ${JSON.stringify({ id: "chat_crusoe_1", model: "meta-llama/Llama-3.3-70B-Instruct", choices: [{ index: 0, delta: { role: "assistant", content: "A fictional castaway." }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
		}]);

		const result = await executor(args(ir));
		mock.restore();

		expect(mock.calls).toHaveLength(1);
		expect(mock.calls[0]?.headers).toMatchObject({
			Authorization: expect.stringMatching(/^Bearer /),
		});
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "meta-llama/Llama-3.3-70B-Instruct",
			stream: true,
			messages: [
				{ role: "system", content: "Be concise." },
				{ role: "user", content: "Who is Robinson Crusoe?" },
			],
		});
		expect(result.kind).toBe("stream");
	});

	it("normalizes a documented OpenAI-compatible response and token usage into IR", () => {
		const response = openAIChatToIR({
			id: "chat_crusoe_1",
			object: "chat.completion",
			created: 1_786_464_000,
			model: "meta-llama/Llama-3.3-70B-Instruct",
			choices: [{
				index: 0,
				message: { role: "assistant", content: "A fictional castaway." },
				finish_reason: "stop",
			}],
			usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
		}, "req_crusoe_contract", "meta-llama/Llama-3.3-70B-Instruct", "crusoe");

		expect(response.choices[0]?.message.content).toEqual([
			{ type: "text", text: "A fictional castaway." },
		]);
		expect(response.usage).toMatchObject({
			inputTokens: 12,
			outputTokens: 4,
			totalTokens: 16,
		});
	});
});
