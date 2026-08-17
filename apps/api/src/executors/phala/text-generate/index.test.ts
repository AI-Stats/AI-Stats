import { afterEach, describe, expect, it, vi } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./index";

afterEach(teardownTestRuntime);

function args(ir: IRChatRequest): ExecutorExecuteArgs {
	return { ir, requestId: "req_phala", workspaceId: "ws_phala", providerId: "phala",
		endpoint: "chat/completions", protocol: "openai.chat.completions", capability: "text.generate",
		providerModelSlug: "phala/uncensored-24b", capabilityParams: null, byokMeta: [],
		pricingCard: { rules: [] }, meta: { returnUpstreamRequest: true } } as ExecutorExecuteArgs;
}

describe("Phala confidential text generation", () => {
	it("uses the confidential endpoint and preserves receipt, response, usage, and tools", async () => {
		setupRuntimeFromEnv({ PHALA_API_KEY: "test-phala-key" } as any);
		const mock = installFetchMock([{ match: (url) => url === "https://inference.phala.com/v1/chat/completions", response: jsonResponse({
			id: "chatcmpl_phala", object: "chat.completion", created: 1, model: "phala/uncensored-24b",
			choices: [{ index: 0, message: { role: "assistant", content: "private" }, finish_reason: "stop" }],
			usage: { prompt_tokens: 7, completion_tokens: 1, total_tokens: 8 },
		}, { headers: { "x-receipt-id": "rcpt_verified", "x-aci-keyset-digest": "sha256:test" } }) }]);
		const result = await execute(args({ model: "phala/phala/uncensored-24b", stream: false,
			messages: [{ role: "user", content: [{ type: "text", text: "Run privately" }] }],
			maxTokens: 64, temperature: 0.2,
			tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }], toolChoice: "auto" }));
		mock.restore();
		expect(mock.calls[0]?.headers.Authorization).toBe("Bearer test-phala-key");
		expect(mock.calls[0]?.bodyJson).toMatchObject({ model: "phala/uncensored-24b", max_tokens: 64, temperature: 0.2, tool_choice: "auto" });
		expect(result.upstream.headers.get("x-receipt-id")).toBe("rcpt_verified");
		expect(result.upstream.headers.get("x-aci-keyset-digest")).toBe("sha256:test");
		expect((result as any).bill?.usage).toMatchObject({ input_tokens: 7, output_tokens: 1, total_tokens: 8 });
	});

	it("preserves confidential streaming and terminal usage requests", async () => {
		setupRuntimeFromEnv({ PHALA_API_KEY: "test-phala-key" } as any);
		const mock = installFetchMock([{ match: (url) => url === "https://inference.phala.com/v1/chat/completions",
			response: new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream", "x-receipt-id": "rcpt_stream" } }) }]);
		const result = await execute(args({ model: "phala/phala/uncensored-24b", stream: true, messages: [{ role: "user", content: [{ type: "text", text: "Hi" }] }] }));
		mock.restore();
		expect(result.kind).toBe("stream");
		expect(result.upstream.headers.get("x-receipt-id")).toBe("rcpt_stream");
		expect(mock.calls[0]?.bodyJson).toMatchObject({ stream: true, stream_options: { include_usage: true } });
	});
});
