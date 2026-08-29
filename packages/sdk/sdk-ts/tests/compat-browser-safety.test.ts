import { afterEach, describe, expect, it } from "vitest";
import { OpenAI } from "../src/compat/openai.js";
import { Anthropic } from "../src/compat/anthropic.js";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
	if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

function simulateBrowser() {
	Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
}

describe("compatibility client browser safety", () => {
	it("rejects API keys in browsers by default", () => {
		simulateBrowser();
		expect(() => new OpenAI({ apiKey: "secret" })).toThrow("disabled in browser environments");
		expect(() => new Anthropic({ apiKey: "secret" })).toThrow("disabled in browser environments");
	});

	it("requires an explicit dangerous browser opt-in", () => {
		simulateBrowser();
		expect(() => new OpenAI({ apiKey: "secret", dangerouslyAllowBrowser: true })).not.toThrow();
		expect(() => new Anthropic({ apiKey: "secret", dangerouslyAllowBrowser: true })).not.toThrow();
	});
});
