import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatKey, resolveOpenAICompatRoute } from "../config";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("MiniMax OpenAI-compatible config", () => {
	it("uses the documented global Chat Completions endpoint for both offers", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ MINIMAX_API_KEY: "test-minimax-key" } as any);

		expect(resolveOpenAICompatRoute("minimax", "MiniMax-M3")).toBe("chat");
		expect(resolveOpenAICompatRoute("minimax-lightning", "MiniMax-M2.7-highspeed")).toBe("chat");
		expect(openAICompatUrl("minimax", "/chat/completions")).toBe(
			"https://api.minimax.io/v1/chat/completions",
		);
		expect(openAICompatUrl("minimax-lightning", "/chat/completions")).toBe(
			"https://api.minimax.io/v1/chat/completions",
		);
	});

	it("uses the documented MiniMax API key for both offers", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ MINIMAX_API_KEY: "test-minimax-key" } as any);

		for (const providerId of ["minimax", "minimax-lightning"]) {
			expect(resolveOpenAICompatKey({ providerId, byokMeta: [] } as any).key).toBe("test-minimax-key");
		}
	});
});
