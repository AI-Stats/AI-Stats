import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatKey, resolveOpenAICompatRoute } from "../openai-compatible/config";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ SCW_SECRET_KEY: "scw-test" } as any));
afterAll(teardownTestRuntime);

describe("Scaleway Generative APIs transport", () => {
	it("uses the official Paris serverless Chat and Responses routes", async () => {
		expect(openAICompatUrl("scaleway", "/chat/completions")).toBe("https://api.scaleway.ai/v1/chat/completions");
		expect(openAICompatUrl("scaleway", "/responses")).toBe("https://api.scaleway.ai/v1/responses");
		expect(resolveOpenAICompatRoute("scaleway", "gpt-oss-120b")).toBe("responses");
		const key = await resolveOpenAICompatKey({ providerId: "scaleway", byokMeta: [] } as any);
		expect(openAICompatHeaders("scaleway", key.key).Authorization).toBe("Bearer scw-test");
	});
});
