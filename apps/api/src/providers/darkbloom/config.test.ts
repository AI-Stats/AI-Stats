import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import {
	setupRuntimeFromEnv,
	teardownTestRuntime,
} from "../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ DARKBLOOM_API_KEY: "sk-db-test" } as any));
afterAll(teardownTestRuntime);

describe("Darkbloom OpenAI-compatible configuration", () => {
	it("uses the documented base URL and bearer authentication", () => {
		expect(openAICompatUrl("darkbloom", "/chat/completions")).toBe(
			"https://api.darkbloom.dev/v1/chat/completions",
		);
		expect(resolveOpenAICompatKey({ providerId: "darkbloom", byokMeta: [] } as any))
			.toMatchObject({ key: "sk-db-test", source: "gateway" });
		expect(openAICompatHeaders("darkbloom", "sk-db-test")).toMatchObject({
			Authorization: "Bearer sk-db-test",
			"Content-Type": "application/json",
		});
	});

	it("routes text generation through Darkbloom's documented Responses API", () => {
		expect(resolveOpenAICompatRoute("darkbloom", "gemma-4-26b")).toBe("responses");
		expect(openAICompatUrl("darkbloom", "/responses")).toBe(
			"https://api.darkbloom.dev/v1/responses",
		);
	});
});
