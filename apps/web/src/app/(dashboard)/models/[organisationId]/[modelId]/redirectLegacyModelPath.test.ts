import { getLegacyModelRedirectPath } from "./redirectLegacyModelPath";

describe("getLegacyModelRedirectPath", () => {
	it("redirects legacy model subroutes to the canonical model page", () => {
		expect(getLegacyModelRedirectPath("openai/gpt-5", {})).toBe(
			"/models/openai/gpt-5",
		);
	});

	it("preserves query parameters without adding a section hash", () => {
		expect(
			getLegacyModelRedirectPath("openai/gpt-5", {
				ref: "legacy",
				filter: ["fast", "cheap"],
			}),
		).toBe(
			"/models/openai/gpt-5?ref=legacy&filter=fast&filter=cheap",
		);
	});
});
