import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
} from "../openai-compatible/config";
import {
	setupRuntimeFromEnv,
	setupTestRuntime,
	teardownTestRuntime,
} from "../../../tests/helpers/runtime";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Crusoe OpenAI-compatible configuration", () => {
	it("uses the documented inference endpoint and bearer API key", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ CRUSOE_API_KEY: "crusoe-test-key" } as any);

		expect(openAICompatUrl("crusoe", "/chat/completions")).toBe(
			"https://api.inference.crusoecloud.com/v1/chat/completions",
		);
		expect(resolveOpenAICompatKey({
			providerId: "crusoe",
			byokMeta: [],
		} as any)).toMatchObject({ key: "crusoe-test-key", source: "gateway" });
		expect(openAICompatHeaders("crusoe", "crusoe-test-key")).toMatchObject({
			Authorization: "Bearer crusoe-test-key",
			"Content-Type": "application/json",
		});
	});

	it("allows an explicit base URL override for private deployments", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			CRUSOE_API_KEY: "crusoe-test-key",
			CRUSOE_BASE_URL: "https://inference.example.test/",
		} as any);

		expect(openAICompatUrl("crusoe", "/chat/completions")).toBe(
			"https://inference.example.test/v1/chat/completions",
		);
	});
});
