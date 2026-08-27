import { describe, expect, it } from "vitest";
import { MANCER_OPENAI_COMPAT_CONFIGS } from "./config";

describe("Mancer provider config", () => {
	it("uses the current first-party OpenAI-compatible server and path", () => {
		expect(MANCER_OPENAI_COMPAT_CONFIGS.mancer).toMatchObject({
			baseUrl: "https://neuro.mancer.tech",
			pathPrefix: "/oai/v1",
			apiKeyEnv: "MANCER_API_KEY",
		});
	});
});
