import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatRoute } from "../openai-compatible/config";

beforeAll(() => setupRuntimeFromEnv({ TENSORIX_API_KEY: "tensorx-test" } as any));
afterAll(teardownTestRuntime);

describe("TensorX compatibility aliases", () => {
	it.each(["tensorix", "tensorx"])("uses the current TensorX host for %s", (providerId) => {
		expect(openAICompatUrl(providerId, "/chat/completions")).toBe("https://api.tensorx.ai/v1/chat/completions");
		expect(resolveOpenAICompatRoute(providerId, "z-ai/glm-5.2")).toBe("chat");
	});
});
