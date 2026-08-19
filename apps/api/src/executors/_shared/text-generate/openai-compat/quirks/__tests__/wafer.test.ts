import { describe, expect, it } from "vitest";
import { irToOpenAIChat } from "../../transform-chat";
import { waferQuirks } from "../../providers/wafer/quirks";

describe("Wafer quirks", () => {
	it("does not forward Phaseo service tiers upstream", () => {
		const request: Record<string, unknown> = { service_tier: "priority" };
		waferQuirks.transformRequest?.({ request, ir: {} as any });
		expect(request.service_tier).toBeUndefined();
	});

	it("maps IR reasoning to Wafer's documented thinking object", () => {
		const request = irToOpenAIChat({
			model: "GLM-5.2",
			messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
			reasoning: { enabled: false },
		} as any, "GLM-5.2", "wafer");

		expect(request.thinking).toEqual({ type: "disabled" });
	});

	it("maps explicit Wafer reasoning levels to reasoning_effort", () => {
		const request = irToOpenAIChat({
			model: "GLM-5.2",
			messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
			reasoning: { effort: "high" },
		} as any, "GLM-5.2", "wafer");

		expect(request.reasoning_effort).toBe("high");
		expect(request.thinking).toBeUndefined();
	});

	it("preserves reasoning context on assistant messages", () => {
		const request = irToOpenAIChat({
			model: "Kimi-K3",
			messages: [{
				role: "assistant",
				content: [{ type: "reasoning_text", text: "prior thought" }],
			}],
		} as any, "Kimi-K3", "wafer");

		expect(request.messages[0].reasoning_content).toBe("prior thought");
	});
});
