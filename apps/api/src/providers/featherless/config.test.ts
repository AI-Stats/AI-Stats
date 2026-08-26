import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ FEATHERLESS_API_KEY: "fl-test-key" } as any));
afterAll(teardownTestRuntime);

describe("Featherless OpenAI-compatible configuration", () => {
	it("uses the documented Chat Completions endpoint and bearer API key", () => {
		expect(resolveOpenAICompatRoute("featherless", "Qwen/Qwen3-32B")).toBe("chat");
		expect(openAICompatUrl("featherless", "/chat/completions")).toBe(
			"https://api.featherless.ai/v1/chat/completions",
		);
		expect(resolveOpenAICompatKey({ providerId: "featherless", byokMeta: [] } as any))
			.toMatchObject({ key: "fl-test-key", source: "gateway" });
		expect(openAICompatHeaders("featherless", "fl-test-key")).toMatchObject({
			Authorization: "Bearer fl-test-key",
			"Content-Type": "application/json",
		});
	});
});
