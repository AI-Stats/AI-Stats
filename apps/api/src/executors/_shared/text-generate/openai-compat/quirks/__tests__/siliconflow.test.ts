import { describe, expect, it } from "vitest";
import { siliconFlowQuirks } from "../../providers/siliconflow/quirks";

describe("SiliconFlow OpenAI-compatible quirks", () => {
	it("maps gateway reasoning controls to SiliconFlow thinking fields", () => {
		const request: any = {};
		siliconFlowQuirks.transformRequest?.({
			request,
			ir: { reasoning: { enabled: false, maxTokens: 8192 } } as any,
			model: "Qwen/Qwen3-32B",
		});

		expect(request).toEqual({
			enable_thinking: false,
			thinking_budget: 8192,
		});
	});

	it("extracts SiliconFlow reasoning_content without losing answer text", () => {
		expect(siliconFlowQuirks.extractReasoning?.({
			choice: { message: { reasoning_content: "private reasoning" } },
			rawContent: "final answer",
		})).toEqual({
			main: "final answer",
			reasoning: ["private reasoning"],
		});
	});
});
