import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatRoute } from "../openai-compatible/config";

beforeAll(() => setupRuntimeFromEnv({ UPSTAGE_API_KEY: "upstage-test" } as any));
afterAll(teardownTestRuntime);

describe("Upstage config", () => {
	it("uses the documented /v1 Chat Completions endpoint", () => {
		expect(openAICompatUrl("upstage", "/chat/completions")).toBe("https://api.upstage.ai/v1/chat/completions");
		expect(resolveOpenAICompatRoute("upstage", "solar-pro4")).toBe("chat");
	});
});
