import { afterEach, describe, expect, it } from "vitest";
import { OpenAI } from "../src/compat/openai.js";
import { Anthropic } from "../src/compat/anthropic.js";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
const originalWorkerGlobalScope = Object.getOwnPropertyDescriptor(globalThis, "WorkerGlobalScope");

afterEach(() => {
	if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
	if (originalSelf) Object.defineProperty(globalThis, "self", originalSelf);
	else Reflect.deleteProperty(globalThis, "self");
	if (originalWorkerGlobalScope) Object.defineProperty(globalThis, "WorkerGlobalScope", originalWorkerGlobalScope);
	else Reflect.deleteProperty(globalThis, "WorkerGlobalScope");
});

function simulateBrowser() {
	Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
}

function simulateBrowserWorker() {
	class WorkerGlobalScope {}
	Object.defineProperty(globalThis, "WorkerGlobalScope", { configurable: true, value: WorkerGlobalScope });
	Object.defineProperty(globalThis, "self", { configurable: true, value: new WorkerGlobalScope() });
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

	it("rejects API keys in browser workers without a window global", () => {
		simulateBrowserWorker();
		expect(() => new OpenAI({ apiKey: "secret" })).toThrow("disabled in browser environments");
		expect(() => new Anthropic({ apiKey: "secret" })).toThrow("disabled in browser environments");
		expect(() => new OpenAI({ apiKey: "secret", dangerouslyAllowBrowser: true })).not.toThrow();
	});
});
