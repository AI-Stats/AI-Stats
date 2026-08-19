import { describe, expect, it } from "vitest";
import { shouldForceQianfanChat } from ".";

describe("Baidu Qianfan text executor routing", () => {
	it("preserves Chat requests and leaves Responses requests on the native route", () => {
		expect(shouldForceQianfanChat({ messages: [{ role: "user", content: "hello" }] })).toBe(true);
		expect(shouldForceQianfanChat({ input: "hello" })).toBe(false);
		expect(shouldForceQianfanChat({ input: [], messages: [] })).toBe(false);
	});
});
