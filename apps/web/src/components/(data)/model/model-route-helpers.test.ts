import {
	getModelIdFromParams,
	getModelPath,
} from "./model-route-helpers";

describe("model detail routes", () => {
	it("round-trips encoded nested model slugs from direct navigation", () => {
		const modelId = getModelIdFromParams({
			organisationId: "openrouter",
			modelId: "meta-llama%2Fllama-3.1-8b%3Afree",
		});

		expect(modelId).toBe("openrouter/meta-llama/llama-3.1-8b:free");
		expect(getModelPath(modelId)).toBe(
			"/models/openrouter/meta-llama%2Fllama-3.1-8b%3Afree",
		);
	});
});
