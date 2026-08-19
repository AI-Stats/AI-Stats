import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IREmbeddingsRequest } from "@core/ir";
import { resolveProviderExecutor } from "@executors/index";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ OVH_AI_ENDPOINTS_ACCESS_TOKEN: "ovh-test-key" } as any));
afterAll(teardownTestRuntime);

describe("OVHcloud embeddings", () => {
	it("uses the OpenAI-compatible endpoint and preserves dimensions, encoding and usage", async () => {
		const executor = resolveProviderExecutor("ovhcloud", "embeddings");
		expect(executor).toBeTruthy();
		const mock = installFetchMock([{
			match: (url) => url === "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/embeddings",
			response: jsonResponse({
				object: "list",
				model: "Qwen3-Embedding-8B",
				data: [{ object: "embedding", index: 0, embedding: "AAAA" }],
				usage: { prompt_tokens: 7, total_tokens: 7 },
			}, { headers: { "x-request-id": "ovh-embed-1" } }),
		}]);
		const result = await executor!({
			ir: {
				model: "qwen/qwen3-embedding-8b",
				input: ["bonjour"],
				encodingFormat: "base64",
				dimensions: 1024,
				userId: "end-user-1",
			} satisfies IREmbeddingsRequest,
			requestId: "req_ovh_embeddings",
			workspaceId: "ws_ovh",
			providerId: "ovhcloud",
			endpoint: "embeddings",
			protocol: "openai.embeddings",
			capability: "embeddings",
			providerModelSlug: "Qwen3-Embedding-8B",
			capabilityParams: null,
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		mock.restore();

		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer ovh-test-key");
		expect(mock.calls[0]?.bodyJson).toEqual({
			model: "Qwen3-Embedding-8B",
			input: ["bonjour"],
			encoding_format: "base64",
			dimensions: 1024,
			user: "end-user-1",
		});
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") {
			expect(result.ir).toMatchObject({
				model: "Qwen3-Embedding-8B",
				data: [{ index: 0, embedding: "AAAA" }],
				usage: { inputTokens: 7, totalTokens: 7 },
			});
			expect(result.bill.usage).toMatchObject({ input_text_tokens: 7, embedding_tokens: 7 });
		}
	});
});
