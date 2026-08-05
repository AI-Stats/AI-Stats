import { describe, expect, it } from "vitest";
import { isAllowedExternalUrl } from "./desktop";

describe("isAllowedExternalUrl", () => {
	it.each([
		"https://phaseo.app/models",
		"https://docs.phaseo.app/quickstart",
		"https://github.com/phaseoteam/Phaseo",
	])("allows trusted Phaseo links: %s", (url) => {
		expect(isAllowedExternalUrl(url)).toBe(true);
	});

	it.each([
		"http://phaseo.app/models",
		"https://phaseo.app.example.com",
		"javascript:alert(1)",
		"not-a-url",
	])("rejects unsafe links: %s", (url) => {
		expect(isAllowedExternalUrl(url)).toBe(false);
	});
});
