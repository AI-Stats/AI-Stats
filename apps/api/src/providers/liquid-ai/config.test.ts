import { afterAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";

afterAll(teardownTestRuntime);

describe("Liquid AI family configuration", () => {
	it("does not dispatch to the retired public hosted endpoint by default", () => {
		setupRuntimeFromEnv({ LIQUID_API_KEY: "liquid-test-key" } as any);

		expect(() => openAICompatUrl("liquid", "/chat/completions"))
			.toThrow("liquid_base_url_missing");
		expect(() => openAICompatUrl("liquid-ai", "/chat/completions"))
			.toThrow("liquid-ai_base_url_missing");
	});

	it("keeps both aliases usable for explicitly configured enterprise endpoints", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			LIQUID_API_KEY: "liquid-test-key",
			LIQUID_BASE_URL: "https://enterprise.liquid.example",
			LIQUID_AI_BASE_URL: "https://enterprise.liquid.example",
		} as any);

		for (const providerId of ["liquid", "liquid-ai"]) {
			expect(resolveOpenAICompatRoute(providerId, "lfm-custom")).toBe("chat");
			expect(openAICompatUrl(providerId, "/chat/completions")).toBe(
				"https://enterprise.liquid.example/v1/chat/completions",
			);
			expect(resolveOpenAICompatKey({ providerId, byokMeta: [] } as any))
				.toMatchObject({ key: "liquid-test-key", source: "gateway" });
			expect(openAICompatHeaders(providerId, "liquid-test-key")).toMatchObject({
				Authorization: "Bearer liquid-test-key",
				"Content-Type": "application/json",
			});
		}
	});
});
