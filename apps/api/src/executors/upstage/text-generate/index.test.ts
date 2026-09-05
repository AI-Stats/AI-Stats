import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ UPSTAGE_API_KEY: "upstage-test" } as any));
afterAll(teardownTestRuntime);

describe("Upstage text.generate contract", () => {
	it("maps Solar reasoning, tools, structured output, and usage", async () => {
		const mock = installFetchMock([{ match: (url) => url === "https://api.upstage.ai/v1/chat/completions", response: jsonResponse({ id: "chatcmpl-upstage", object: "chat.completion", created: 1, model: "solar-pro4", choices: [{ index: 0, message: { role: "assistant", content: "{\"answer\":42}" }, finish_reason: "stop" }], usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 } }) }]);
		const result = await executor({ ir: { model: "upstage/solar-pro-4", messages: [{ role: "user", content: [{ type: "text", text: "JSON answer" }] }], stream: false, maxTokens: 128, temperature: 0.3, topP: 0.9, reasoning: { effort: "high" }, responseFormat: { type: "json_object" }, tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }] } as any, requestId: "req_upstage", workspaceId: "ws_upstage", providerId: "upstage", endpoint: "chat.completions", protocol: "openai.chat", capability: "text.generate", providerModelSlug: "solar-pro4", capabilityParams: null, byokMeta: [], pricingCard: { rules: [] }, meta: { returnUpstreamRequest: true }, stream: false } as ExecutorExecuteArgs);
		mock.restore();
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer upstage-test");
		expect(mock.calls[0]?.bodyJson).toMatchObject({ model: "solar-pro4", max_tokens: 128, temperature: 0.3, top_p: 0.9, reasoning_effort: "high", response_format: { type: "json_object" }, stream: false });
		expect(mock.calls[0]?.bodyJson?.tools).toHaveLength(1);
		expect((result as any).ir.usage).toMatchObject({ inputTokens: 15, outputTokens: 8, totalTokens: 23 });
	});
});
