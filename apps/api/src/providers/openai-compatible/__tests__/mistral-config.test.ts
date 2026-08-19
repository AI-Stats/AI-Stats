import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatKey, resolveOpenAICompatRoute } from "../config";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Mistral OpenAI-compatible config", () => {
	it("routes both regional offers to their documented Chat endpoints", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			MISTRAL_BASE_URL: "https://api.mistral.ai",
			MISTRAL_EU_BASE_URL: "https://api.eu.mistral.ai",
		} as any);
		expect(resolveOpenAICompatRoute("mistral", "mistral-large-latest")).toBe("chat");
		expect(resolveOpenAICompatRoute("mistral-eu", "mistral-large-latest")).toBe("chat");
		expect(openAICompatUrl("mistral", "/chat/completions")).toBe(
			"https://api.mistral.ai/v1/chat/completions",
		);
		expect(openAICompatUrl("mistral-eu", "/chat/completions")).toBe(
			"https://api.eu.mistral.ai/v1/chat/completions",
		);
	});

	it("prefers the official MISTRAL_API_KEY and retains the legacy fallback", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			MISTRAL_API_KEY: "official-key",
			MISTRAL_AI_API_KEY: "legacy-key",
		} as any);
		expect(resolveOpenAICompatKey({ providerId: "mistral", byokMeta: [] } as any).key).toBe("official-key");

		teardownTestRuntime();
		setupRuntimeFromEnv({ MISTRAL_AI_API_KEY: "legacy-key" } as any);
		expect(resolveOpenAICompatKey({ providerId: "mistral-eu", byokMeta: [] } as any).key).toBe("legacy-key");
	});
});
