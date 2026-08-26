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

describe("Avian OpenAI-compatible configuration", () => {
	it("uses the documented endpoint and bearer API key", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ AVIAN_API_KEY: "avian-test-key" } as any);

		expect(openAICompatUrl("avian", "/chat/completions")).toBe(
			"https://api.avian.io/v1/chat/completions",
		);
		expect(resolveOpenAICompatKey({
			providerId: "avian",
			byokMeta: [],
		} as any)).toMatchObject({ key: "avian-test-key", source: "gateway" });
		expect(openAICompatHeaders("avian", "avian-test-key")).toMatchObject({
			Authorization: "Bearer avian-test-key",
			"Content-Type": "application/json",
		});
	});
});
