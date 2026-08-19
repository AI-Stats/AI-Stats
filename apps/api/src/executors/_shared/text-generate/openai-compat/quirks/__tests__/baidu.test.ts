import { describe, expect, it } from "vitest";
import { baiduQuirks } from "../../providers/baidu/quirks";

describe("baidu request quirks", () => {
	it("maps IR reasoning and preserves Qianfan Chat extensions", () => {
		const request: Record<string, unknown> = { messages: [] };
		baiduQuirks.transformRequest?.({
			request,
			ir: {
				reasoning: { enabled: true, effort: "xhigh", maxTokens: 2048 },
				rawRequest: { penalty_score: 1.2, thinking_strategy: "short_think" },
			} as any,
		});

		expect(request).toMatchObject({
			enable_thinking: true,
			thinking_budget: 2048,
			thinking_strategy: "short_think",
			reasoning_effort: "max",
			penalty_score: 1.2,
		});
	});

	it("uses Qianfan's thinking object for Responses requests", () => {
		const request: Record<string, unknown> = { input: "hello" };
		baiduQuirks.transformRequest?.({
			request,
			ir: {
				reasoning: { enabled: false },
				rawRequest: { expire_at: 1_800_000_000 },
			} as any,
		});

		expect(request).toMatchObject({
			thinking: { type: "disabled" },
			expire_at: 1_800_000_000,
		});
	});
});
