import { describe, expect, it } from "vitest";
import { sambaNovaQuirks } from "../../providers/sambanova/quirks";

describe("SambaNova quirks", () => {
	it("removes documented ignored/unsupported OpenAI fields", () => {
		const request: Record<string, any> = {
			presence_penalty: 1,
			frequency_penalty: 1,
			logit_bias: { "1": 2 },
			parallel_tool_calls: true,
			metadata: { trace: "x" },
			top_k: 10,
			reasoning_effort: "high",
		};
		sambaNovaQuirks.transformRequest?.({ request, ir: {} as any });
		expect(request).toEqual({ top_k: 10, reasoning_effort: "high" });
	});

	it("enforces n range and the tools incompatibility", () => {
		expect(() => sambaNovaQuirks.transformRequest?.({ request: { n: 9 }, ir: {} as any }))
			.toThrow("sambanova_n_out_of_range");
		expect(() => sambaNovaQuirks.transformRequest?.({
			request: { n: 2, tools: [{ type: "function" }] },
			ir: {} as any,
		})).toThrow("sambanova_n_with_tools_unsupported");
	});
});
