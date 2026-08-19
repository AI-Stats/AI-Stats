import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatRoute } from "../openai-compatible/config";

beforeAll(() => setupRuntimeFromEnv({ TINKER_API_KEY: "tinker-test" } as any));
afterAll(teardownTestRuntime);

describe("Thinking Machines Tinker config", () => {
	it("uses the documented beta inference host and Chat route", () => {
		expect(openAICompatUrl("thinking-machines", "/chat/completions")).toBe("https://tinker.thinkingmachines.dev/services/tinker-prod/oai/api/v1/chat/completions");
		expect(resolveOpenAICompatRoute("thinking-machines", "tinker://checkpoint")).toBe("chat");
	});
});
