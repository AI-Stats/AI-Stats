import { afterEach, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";

describe("NVIDIA NIM OpenAI-compatible configuration", () => {
	afterEach(teardownTestRuntime);

	it("uses the hosted model API Chat endpoint and Bearer authentication", () => {
		setupRuntimeFromEnv({ NVIDIA_API_KEY: "nvapi-test" } as any);
		expect(resolveOpenAICompatRoute("nvidia", "openai/gpt-oss-120b")).toBe("chat");
		expect(openAICompatUrl("nvidia", "/chat/completions"))
			.toBe("https://integrate.api.nvidia.com/v1/chat/completions");
		expect(resolveOpenAICompatKey({ providerId: "nvidia", byokMeta: [] } as any))
			.toMatchObject({ key: "nvapi-test", source: "gateway" });
		expect(openAICompatHeaders("nvidia", "nvapi-test")).toMatchObject({
			Authorization: "Bearer nvapi-test",
			"Content-Type": "application/json",
		});
	});

	it("allows an unauthenticated configurable self-hosted NIM", () => {
		setupRuntimeFromEnv({ NVIDIA_BASE_URL: "http://nim.internal:8000" } as any);
		expect(openAICompatUrl("nvidia", "/chat/completions"))
			.toBe("http://nim.internal:8000/v1/chat/completions");
		expect(resolveOpenAICompatKey({ providerId: "nvidia", byokMeta: [] } as any))
			.toMatchObject({ key: "", source: "gateway" });
		expect(openAICompatHeaders("nvidia", "")).toEqual({ "Content-Type": "application/json" });
	});
});
