import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ GROQ_API_KEY: "gsk-test" } as any));
afterAll(teardownTestRuntime);

describe("Groq OpenAI-compatible configuration", () => {
	it("uses Groq's documented beta Responses endpoint and bearer key", () => {
		expect(resolveOpenAICompatRoute("groq", "qwen/qwen3.6-27b")).toBe("responses");
		expect(openAICompatUrl("groq", "/responses")).toBe(
			"https://api.groq.com/openai/v1/responses",
		);
		expect(resolveOpenAICompatKey({ providerId: "groq", byokMeta: [] } as any))
			.toMatchObject({ key: "gsk-test", source: "gateway" });
		expect(openAICompatHeaders("groq", "gsk-test")).toMatchObject({
			Authorization: "Bearer gsk-test",
			"Content-Type": "application/json",
		});
	});
});
