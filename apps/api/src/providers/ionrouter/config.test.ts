import { describe, expect, it } from "vitest";
import { resolveIonRouterUrlProvider } from "./config";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";

describe("IonRouter model endpoint routing", () => {
	it("uses the dedicated Kimi and MiniMax hosts", () => {
		expect(resolveIonRouterUrlProvider("kimi-k2.5")).toBe("ionrouter-kimi");
		expect(resolveIonRouterUrlProvider("ionrouter/kimi-k2.5")).toBe("ionrouter-kimi");
		expect(resolveIonRouterUrlProvider("minimax-m2.5")).toBe("ionrouter-minimax");
		expect(resolveIonRouterUrlProvider("qwen3.5-122b-a10b")).toBe("ionrouter");
	});

	it("normalizes IonRouter's system_prompt alias into a system message", () => {
		const ir = decodeOpenAIChatRequest({
			model: "qwen3-30b-a3b",
			system_prompt: "Be concise.",
			messages: [{ role: "user", content: "Hello" }],
		} as any);
		expect(ir.messages[0]).toEqual({
			role: "system",
			content: [{ type: "text", text: "Be concise." }],
		});
	});
});
