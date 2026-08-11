import { describe, expect, it } from "vitest";
import { isByokKeyEligible } from "./byok";

describe("isByokKeyEligible", () => {
	it("allows an unscoped key", () => {
		expect(isByokKeyEligible({ requestedModel: "openai/gpt-5", apiKeyId: "key-a" })).toBe(true);
	});

	it("requires both selected model and API key scopes to match", () => {
		const scope = { allowedModelSlugs: ["openai/gpt-5"], allowedApiKeyIds: ["key-a"] };
		expect(isByokKeyEligible({ ...scope, requestedModel: "openai/gpt-5", apiKeyId: "key-a" })).toBe(true);
		expect(isByokKeyEligible({ ...scope, requestedModel: "openai/gpt-4.1", apiKeyId: "key-a" })).toBe(false);
		expect(isByokKeyEligible({ ...scope, requestedModel: "openai/gpt-5", apiKeyId: "key-b" })).toBe(false);
	});

	it("treats empty arrays as all", () => {
		expect(isByokKeyEligible({ allowedModelSlugs: [], allowedApiKeyIds: [], requestedModel: "any", apiKeyId: "any" })).toBe(true);
	});
});
