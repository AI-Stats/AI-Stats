import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ TENSORIX_API_KEY: "tensorx-test" } as any));
afterAll(teardownTestRuntime);

describe("TensorX text.generate contract", () => {
	it.each(["tensorix", "tensorx"])("uses Chat Completions for alias %s and preserves usage", async (providerId) => {
		const mock = installFetchMock([{ match: (url) => url === "https://api.tensorx.ai/v1/chat/completions", response: jsonResponse({ id: "chatcmpl-tensorx", object: "chat.completion", created: 1, model: "z-ai/glm-5.2", choices: [{ index: 0, message: { role: "assistant", content: "Paris", reasoning_content: "Recall geography" }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19, prompt_tokens_details: { cached_tokens: 3 }, completion_tokens_details: { reasoning_tokens: 2 } } }) }]);
		const result = await executor({ ir: { model: "z-ai/glm-5.2", messages: [{ role: "user", content: [{ type: "text", text: "Capital of France?" }] }], stream: false, maxTokens: 64, temperature: 0.4, tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }], responseFormat: { type: "json_object" } } as any, requestId: "req_tensorx", workspaceId: "ws_tensorx", providerId, endpoint: "chat.completions", protocol: "openai.chat", capability: "text.generate", providerModelSlug: "z-ai/glm-5.2", capabilityParams: null, byokMeta: [], pricingCard: { rules: [] }, meta: { returnUpstreamRequest: true }, stream: false } as ExecutorExecuteArgs);
		mock.restore();
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer tensorx-test");
		expect(mock.calls[0]?.bodyJson).toMatchObject({ model: "z-ai/glm-5.2", max_tokens: 64, temperature: 0.4, stream: false, response_format: { type: "json_object" } });
		expect((result as any).ir.usage).toMatchObject({ inputTokens: 12, outputTokens: 7, totalTokens: 19, cachedInputTokens: 3, reasoningTokens: 2 });
	});
});
