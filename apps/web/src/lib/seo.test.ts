import { resolveSiteUrl } from "./seo";

describe("resolveSiteUrl", () => {
	it("keeps the canonical Phaseo host", () => {
		expect(resolveSiteUrl("https://phaseo.app/")).toBe(
			"https://phaseo.app",
		);
	});

	it("upgrades the canonical Phaseo host to HTTPS", () => {
		expect(resolveSiteUrl("http://phaseo.app/")).toBe(
			"https://phaseo.app",
		);
	});

	it("preserves explicitly configured non-legacy hosts", () => {
		expect(resolveSiteUrl("https://preview.phaseo.app/")).toBe(
			"https://preview.phaseo.app",
		);
	});

	it("falls back to localhost when no site URL is configured", () => {
		expect(resolveSiteUrl(undefined)).toBe("http://localhost:3000");
	});
});
