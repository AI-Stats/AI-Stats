import { describe, expect, it } from "vitest";
import { stepFunQuirks } from "../../providers/stepfun/quirks";

describe("StepFun OpenAI-compatible quirks", () => {
	it("preserves Chat generation count and documented reasoning format", () => {
		const request: any = {};
		stepFunQuirks.transformRequest?.({
			request,
			ir: { vendor: { stepfun: { n: 3, reasoning_format: "deepseek-style" } } } as any,
			model: "step-3.5-flash",
		});
		expect(request).toEqual({ n: 3, reasoning_format: "deepseek-style" });
	});

	it("normalizes both buffered and streamed StepFun reasoning", () => {
		expect(stepFunQuirks.extractReasoning?.({
			choice: { message: { reasoning: "private chain" } },
			rawContent: "answer",
		})).toEqual({ main: "answer", reasoning: ["private chain"] });

		const chunk: any = { choices: [{ delta: { reasoning: "next step" } }] };
		stepFunQuirks.transformStreamChunk?.({ chunk, accumulated: {} });
		expect(chunk.choices[0].delta.reasoning_content).toBe("next step");
	});
});
