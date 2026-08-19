import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ TINKER_API_KEY: "tinker-test" } as any));
afterAll(teardownTestRuntime);

describe("Thinking Machines Tinker compatible inference", () => {
	it("uses a sampler checkpoint on the beta Chat Completions route", async () => {
		const checkpoint = "tinker://0034d8c9-0a88-52a9-b2b7-bce7cb1e6fef:train:0/sampler_weights/000080";
		const mock = installFetchMock([{ match: (url) => url.endsWith("/oai/api/v1/chat/completions"), response: jsonResponse({ id: "chatcmpl-tinker", object: "chat.completion", created: 1, model: checkpoint, choices: [{ index: 0, message: { role: "assistant", content: "391", reasoning_content: "17 multiplied by 23" }, finish_reason: "stop" }], usage: { prompt_tokens: 9, completion_tokens: 5, total_tokens: 14 } }) }]);
		const result = await executor({ ir: { model: checkpoint, messages: [{ role: "user", content: [{ type: "text", text: "17*23?" }] }], stream: false, maxTokens: 32, temperature: 0.2, topP: 0.9, topK: 20, seed: 4, reasoning: { effort: "high" } } as any, requestId: "req_tinker", workspaceId: "ws_tinker", providerId: "thinking-machines", endpoint: "chat.completions", protocol: "openai.chat", capability: "text.generate", providerModelSlug: checkpoint, capabilityParams: null, byokMeta: [], pricingCard: { rules: [] }, meta: { returnUpstreamRequest: true }, stream: false } as ExecutorExecuteArgs);
		mock.restore();
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer tinker-test");
		expect(mock.calls[0]?.bodyJson).toMatchObject({ model: checkpoint, stream: false, max_tokens: 32, temperature: 0.2, top_p: 0.9, top_k: 20, seed: 4, reasoning_effort: "high" });
		expect((result as any).ir.usage).toMatchObject({ inputTokens: 9, outputTokens: 5, totalTokens: 14 });
	});
});
