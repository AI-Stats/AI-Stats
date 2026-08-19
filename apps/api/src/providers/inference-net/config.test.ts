import { afterAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";

afterAll(teardownTestRuntime);

describe("Inference.net OpenAI-compatible configuration", () => {
	it("uses the documented Chat endpoint and official API key environment name", () => {
		setupRuntimeFromEnv({ INFERENCE_API_KEY: "inf-test-key" } as any);

		expect(resolveOpenAICompatRoute("inference-net", "glm-5.2")).toBe("chat");
		expect(openAICompatUrl("inference-net", "/chat/completions")).toBe(
			"https://api.inference.net/v1/chat/completions",
		);
		expect(resolveOpenAICompatKey({ providerId: "inference-net", byokMeta: [] } as any))
			.toMatchObject({ key: "inf-test-key", source: "gateway" });
		expect(openAICompatHeaders("inference-net", "inf-test-key")).toMatchObject({
			Authorization: "Bearer inf-test-key",
			"Content-Type": "application/json",
		});
	});

	it("keeps the legacy namespaced key as a compatibility alias", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ INFERENCE_NET_API_KEY: "legacy-test-key" } as any);

		expect(resolveOpenAICompatKey({ providerId: "inference-net", byokMeta: [] } as any))
			.toMatchObject({ key: "legacy-test-key", source: "gateway" });
	});
});
