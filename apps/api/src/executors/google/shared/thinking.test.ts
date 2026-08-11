import { describe, expect, it } from "vitest";
import {
	getDefaultGoogleThinkingLevel,
	getSupportedGoogleThinkingLevels,
	modelSupportsGoogleThinkingLevels,
	resolveGoogleThinkingLevelForEffort,
} from "./thinking";

describe("google thinking level support", () => {
	it("returns explicit levels for known Gemini 3.1 models", () => {
		expect(getSupportedGoogleThinkingLevels("google/gemini-3.1-flash-image-preview")).toEqual([
			"MINIMAL",
			"LOW",
			"MEDIUM",
			"HIGH",
		]);
		expect(getSupportedGoogleThinkingLevels("gemini-3.1-pro-preview")).toEqual([
			"MINIMAL",
			"LOW",
			"MEDIUM",
			"HIGH",
		]);
	});

	it("supports dated slugs via prefix matching", () => {
		expect(
			getSupportedGoogleThinkingLevels("google/gemini-3.1-flash-image-preview-2026-02-26")
		).toEqual(["MINIMAL", "LOW", "MEDIUM", "HIGH"]);
	});

	it("uses Gemma 4's supported on/off thinking levels", () => {
		expect(getSupportedGoogleThinkingLevels("google/gemma-4-26b-a4b:free")).toEqual([
			"MINIMAL",
			"HIGH",
		]);
		expect(getSupportedGoogleThinkingLevels("gemma-4-31b-it")).toEqual([
			"MINIMAL",
			"HIGH",
		]);
		expect(resolveGoogleThinkingLevelForEffort("gemma-4-26b-a4b-it", "minimal")).toBe("MINIMAL");
		expect(resolveGoogleThinkingLevelForEffort("gemma-4-26b-a4b-it", "low")).toBe("MINIMAL");
		expect(resolveGoogleThinkingLevelForEffort("gemma-4-26b-a4b-it", "medium")).toBe("HIGH");
		expect(resolveGoogleThinkingLevelForEffort("gemma-4-31b-it", "high")).toBe("HIGH");
	});

	it("defaults hosted Gemma 4 generation to minimal thinking", () => {
		expect(getDefaultGoogleThinkingLevel("google/gemma-4-26b-a4b:free")).toBe("MINIMAL");
		expect(getDefaultGoogleThinkingLevel("gemma-4-31b-it")).toBe("MINIMAL");
		expect(getDefaultGoogleThinkingLevel("gemini-3.1-pro-preview")).toBeUndefined();
	});

	it("maps effort values to Google thinking levels", () => {
		const model = "google/gemini-3.1-flash-image-preview";
		expect(resolveGoogleThinkingLevelForEffort(model, "minimal")).toBe("MINIMAL");
		expect(resolveGoogleThinkingLevelForEffort(model, "low")).toBe("LOW");
		expect(resolveGoogleThinkingLevelForEffort(model, "medium")).toBe("MEDIUM");
		expect(resolveGoogleThinkingLevelForEffort(model, "high")).toBe("HIGH");
		expect(resolveGoogleThinkingLevelForEffort(model, "xhigh")).toBe("HIGH");
		expect(resolveGoogleThinkingLevelForEffort(model, "max")).toBe("HIGH");
	});

	it("does not use thinking levels for unsupported models", () => {
		expect(modelSupportsGoogleThinkingLevels("gemini-2.5-flash")).toBe(false);
		expect(resolveGoogleThinkingLevelForEffort("gemini-2.5-flash", "medium")).toBeUndefined();
	});
});
