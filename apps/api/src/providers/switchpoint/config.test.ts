import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatConfig } from "../openai-compatible/config";

beforeAll(() => setupRuntimeFromEnv({ SWITCHPOINT_API_KEY: "switchpoint-test" } as any));
afterAll(teardownTestRuntime);

describe("Switchpoint configuration", () => {
	it("uses the exact first-party Chat Completions base and does not claim Responses", () => {
		expect(openAICompatUrl("switchpoint", "/chat/completions")).toBe("https://switchpoint.dev/v1/chat/completions");
		expect(resolveOpenAICompatConfig("switchpoint").supportsResponses).toBe(false);
	});
});
