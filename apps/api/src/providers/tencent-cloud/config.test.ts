import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import { OPENAI_COMPAT_CONFIG } from "../openai-compatible/registry";
import { setupTestRuntime, teardownTestRuntime } from "../../../tests/helpers/runtime";

beforeAll(() => {
	setupTestRuntime();
});

afterAll(() => {
	teardownTestRuntime();
});

describe("Tencent Cloud TokenHub OpenAI-compatible configuration", () => {
	it("uses the international Chat Completions endpoint by default", () => {
		expect(OPENAI_COMPAT_CONFIG["tencent-cloud"]).toMatchObject({
			baseUrl: "https://tokenhub-intl.tencentcloudmaas.com",
			pathPrefix: "/v1",
			apiKeyEnv: "TENCENT_CLOUD_TOKENHUB_API_KEY",
			supportsResponses: false,
		});
		expect(openAICompatUrl("tencent-cloud", "/chat/completions")).toBe(
			"https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions",
		);
		expect(openAICompatHeaders("tencent-cloud", "test-tencent-cloud-key")).toEqual(
			expect.objectContaining({
				Authorization: "Bearer test-tencent-cloud-key",
			}),
		);
		expect(resolveOpenAICompatRoute("tencent-cloud", "hy3")).toBe("chat");
	});
});
