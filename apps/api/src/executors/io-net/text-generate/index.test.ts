import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IO_NET_OPENAI_COMPAT_CONFIGS } from "@providers/io-net/config";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatRoute } from "@providers/openai-compatible/config";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("IO.NET OpenAI-compatible text contract", () => {
	it("uses the official Chat Completions endpoint and Bearer authentication", () => {
		expect(IO_NET_OPENAI_COMPAT_CONFIGS["io-net"].baseUrl).toBe(
			"https://api.intelligence.io.solutions/api/v1",
		);
		expect(resolveOpenAICompatRoute("io-net", "zai-org/GLM-5.3-Flash")).toBe("chat");
		expect(openAICompatUrl("io-net", "/chat/completions")).toBe(
			"https://api.intelligence.io.solutions/api/v1/chat/completions",
		);
		expect(openAICompatHeaders("io-net", "secret").Authorization).toBe("Bearer secret");
	});
});
