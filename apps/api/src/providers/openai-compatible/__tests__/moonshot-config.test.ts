import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatKey, resolveOpenAICompatRoute } from "../config";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Moonshot alias config", () => {
	it("routes every alias to the official Chat endpoint", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ MOONSHOT_AI_BASE_URL: "https://api.moonshot.ai" } as any);
		for (const providerId of ["moonshot-ai", "moonshotai", "moonshot-ai-turbo", "moonshotai-turbo"]) {
			expect(resolveOpenAICompatRoute(providerId, "kimi-k3")).toBe("chat");
			expect(openAICompatUrl(providerId, "/chat/completions")).toBe("https://api.moonshot.ai/v1/chat/completions");
		}
	});

	it("prefers MOONSHOT_API_KEY and retains the legacy fallback", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ MOONSHOT_API_KEY: "official", MOONSHOT_AI_API_KEY: "legacy" } as any);
		expect(resolveOpenAICompatKey({ providerId: "moonshotai", byokMeta: [] } as any).key).toBe("official");
		teardownTestRuntime();
		setupRuntimeFromEnv({ MOONSHOT_AI_API_KEY: "legacy" } as any);
		expect(resolveOpenAICompatKey({ providerId: "moonshot-ai-turbo", byokMeta: [] } as any).key).toBe("legacy");
	});
});
