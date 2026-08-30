import {
	getPublicAppPath,
	getPublicAppRouteSegment,
} from "./publicAppPath";

describe("public app paths", () => {
	it("uses the app name without exposing its database ID", () => {
		expect(getPublicAppRouteSegment("Phaseo Chat")).toBe("phaseo-chat");
		expect(getPublicAppPath("Phaseo Chat")).toBe("/apps/phaseo-chat");
	});

	it("normalizes punctuation and spacing", () => {
		expect(getPublicAppPath("  My AI App!  ")).toBe("/apps/my-ai-app");
	});

	it("matches the database's ASCII slug normalization", () => {
		expect(getPublicAppPath("Café")).toBe("/apps/caf");
	});

	it("preserves a collision-safe host suffix returned by the API", () => {
		expect(getPublicAppPath("my-app--example-com")).toBe("/apps/my-app--example-com");
	});
});
