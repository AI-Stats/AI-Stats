import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { executor } from "./index";

beforeAll(() => setupRuntimeFromEnv({ SWITCHPOINT_API_KEY: "switchpoint-test" } as any));
afterAll(teardownTestRuntime);

describe("Switchpoint text.generate contract", () => {
	it("uses auto-router over Chat Completions and normalizes choices and usage", async () => {
		const mock = installFetchMock([{
			match: (url) => url === "https://switchpoint.dev/v1/chat/completions",
			response: jsonResponse({ id: "chatcmpl-switchpoint", object: "chat.completion", created: 1, model: "auto-router", choices: [{ index: 0, message: { role: "assistant", content: "Hello" }, finish_reason: "stop" }], usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 } }),
		}]);
		const result = await executor({
			ir: { model: "switchpoint/auto-router", messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }], stream: false } as any,
			requestId: "req_switchpoint", workspaceId: "ws_switchpoint", providerId: "switchpoint",
			endpoint: "chat.completions", protocol: "openai.chat", capability: "text.generate",
			providerModelSlug: "auto-router", capabilityParams: { params: ["stream"] }, byokMeta: [],
			pricingCard: { rules: [] }, meta: { returnUpstreamRequest: true }, stream: false,
		} as ExecutorExecuteArgs);
		mock.restore();
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer switchpoint-test");
		expect(mock.calls[0]?.bodyJson).toMatchObject({ model: "auto-router", messages: [{ role: "user", content: "Hello" }], stream: false });
		expect((result as any).ir.choices[0].message.content).toEqual([{ type: "text", text: "Hello" }]);
		expect((result as any).ir.usage).toMatchObject({ inputTokens: 8, outputTokens: 3, totalTokens: 11 });
	});
});
