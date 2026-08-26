import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../tests/helpers/runtime";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("SambaNova Cloud transport", () => {
	it("uses the official v1 Chat and Responses endpoints", () => {
		expect(openAICompatUrl("sambanova", "/chat/completions")).toBe(
			"https://api.sambanova.ai/v1/chat/completions",
		);
		expect(openAICompatUrl("sambanova", "/responses")).toBe(
			"https://api.sambanova.ai/v1/responses",
		);
		expect(resolveOpenAICompatRoute("sambanova", "gpt-oss-120b")).toBe("responses");
	});

	it("uses bearer authentication from SAMBANOVA_API_KEY", async () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ SAMBANOVA_API_KEY: "test-sambanova-key" } as any);
		const key = await resolveOpenAICompatKey({ providerId: "sambanova", byokMeta: [] } as any);
		expect(key.key).toBe("test-sambanova-key");
		expect(openAICompatHeaders("sambanova", key.key).Authorization).toBe("Bearer test-sambanova-key");
	});
});
