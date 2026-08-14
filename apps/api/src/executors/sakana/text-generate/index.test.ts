import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ SAKANA_API_KEY: "sakana-test-key" } as any));
afterAll(() => teardownTestRuntime());

describe("Sakana text.generate executor", () => {
	it("uses the preferred Responses endpoint with multimodal, tools, and distinct max reasoning", async () => {
		const finalResponse = {
			id: "resp_sakana_1",
			object: "response",
			status: "completed",
			model: "fugu-ultra-v1.1",
			output: [{
				type: "message",
				role: "assistant",
				content: [{ type: "output_text", text: "done", annotations: [] }],
			}],
			usage: {
				input_tokens: 10,
				output_tokens: 5,
				total_tokens: 21,
				input_tokens_details: {
					cached_tokens: 2,
					orchestration_input_tokens: 4,
					orchestration_input_cached_tokens: 1,
				},
				output_tokens_details: { orchestration_output_tokens: 2 },
			},
		};
		const mock = installFetchMock([{
			match: (url) => url === "https://api.sakana.ai/v1/responses",
			response: new Response(
				`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: finalResponse })}\n\n`,
				{ headers: { "Content-Type": "text/event-stream" } },
			),
		}]);

		const result = await executor({
			ir: {
				model: "sakana/fugu-ultra",
				stream: false,
				messages: [{
					role: "user",
					content: [
						{ type: "text", text: "Inspect this image" },
						{ type: "image", data: "aW1hZ2U=", mimeType: "image/png" },
					],
				}],
				reasoning: { effort: "max" },
				tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
				metadata: { trace: "test" },
			},
			requestId: "req_sakana",
			workspaceId: "ws_sakana",
			providerId: "sakana",
			endpoint: "responses",
			protocol: "openai.responses",
			capability: "text.generate",
			providerModelSlug: "fugu-ultra-v1.1",
			capabilityParams: { params: ["reasoning", "tools", "metadata"] },
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: {},
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer sakana-test-key");
		expect(mock.calls[0]?.bodyJson).toMatchObject({
			model: "fugu-ultra-v1.1",
			stream: true,
			reasoning: { effort: "max" },
			metadata: { trace: "test" },
		});
		expect(mock.calls[0]?.bodyJson.input[0].content[1]).toMatchObject({ type: "input_image" });
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") {
			expect(result.ir.usage).toMatchObject({
				inputTokens: 14,
				outputTokens: 7,
				cachedInputTokens: 3,
				totalTokens: 21,
			});
		}
	});
});
