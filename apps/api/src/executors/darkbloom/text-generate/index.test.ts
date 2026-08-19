import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

function args(ir: IRChatRequest): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_darkbloom_contract",
		workspaceId: "ws_darkbloom_contract",
		providerId: "darkbloom",
		endpoint: "responses",
		protocol: "openai.responses",
		capability: "text.generate",
		providerModelSlug: "gemma-4-26b",
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

beforeAll(() => setupRuntimeFromEnv({ DARKBLOOM_API_KEY: "sk-db-test" } as any));
afterAll(teardownTestRuntime);

describe("Darkbloom text generate contract", () => {
	it("preserves documented multimodal, tool, structured-output, and sampling fields", async () => {
		const ir: IRChatRequest = {
			model: "gemma-4-26b",
			stream: true,
			messages: [{
				role: "user",
				content: [
					{ type: "image", source: "url", data: "https://example.com/chart.png" },
					{ type: "text", text: "Return the title." },
				],
			}],
			maxTokens: 256,
			temperature: 0.4,
			topP: 0.9,
			topK: 40,
			seed: 7,
			frequencyPenalty: 0.2,
			presencePenalty: 0.1,
			repetitionPenalty: 1.05,
			stop: ["END"],
			tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }],
			toolChoice: { type: "function", name: "lookup" },
			parallelToolCalls: false,
			responseFormat: { type: "json_schema", name: "answer", schema: { type: "object" } },
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.darkbloom.dev/v1/responses",
			response: new Response([
				"event: response.completed\n",
				`data: ${JSON.stringify({ type: "response.completed", response: { id: "resp_db_1", object: "response", model: "gemma-4-26b", output: [], usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 } } })}\n\n`,
				"data: [DONE]\n\n",
			].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
		}]);

		const result = await executor(args(ir));
		mock.restore();

		expect(result.kind).toBe("stream");
		expect(mock.calls).toHaveLength(1);
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "gemma-4-26b",
			stream: true,
			max_output_tokens: 256,
			temperature: 0.4,
			top_p: 0.9,
			top_k: 40,
			seed: 7,
			frequency_penalty: 0.2,
			presence_penalty: 0.1,
			repetition_penalty: 1.05,
			stop: ["END"],
			parallel_tool_calls: false,
			tool_choice: { type: "function", name: "lookup" },
			text: { format: { type: "json_schema", name: "answer" } },
		});
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		expect(mock.calls[0]?.bodyJson?.input[0]?.content).toEqual([
			{ type: "input_image", image_url: "https://example.com/chart.png" },
			{ type: "input_text", text: "Return the title." },
		]);
	});
});
