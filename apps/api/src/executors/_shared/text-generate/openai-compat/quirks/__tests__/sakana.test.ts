import { describe, expect, it } from "vitest";
import { sakanaQuirks } from "../../providers/sakana/quirks";

describe("Sakana quirks", () => {
	it("maps supported reasoning effort to reasoning_effort", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {
			reasoning: {
				effort: "xhigh",
			},
		};

		sakanaQuirks.transformRequest?.({ request, ir, model: "fugu" });

		expect(request.reasoning_effort).toBe("xhigh");
		expect(request.reasoning).toBeUndefined();
	});

	it("preserves max as a distinct effort for Fugu Ultra v1.1", () => {
		const request: Record<string, unknown> = { input: "hard problem", reasoning: {} };
		sakanaQuirks.transformRequest?.({
			request,
			ir: { reasoning: { effort: "max" } } as any,
			model: "fugu-ultra-v1.1",
		});

		expect(request.reasoning).toEqual({ effort: "max" });
		expect(request.reasoning_effort).toBeUndefined();
	});

	it("maps max to xhigh for Fugu models without distinct max", () => {
		const request: Record<string, unknown> = {};
		sakanaQuirks.transformRequest?.({
			request,
			ir: { reasoning: { effort: "max" } } as any,
			model: "fugu-cyber",
		});

		expect(request.reasoning_effort).toBe("xhigh");
	});

	it("maps reasoning enabled=true to default high effort", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {
			reasoning: {
				enabled: true,
			},
		};

		sakanaQuirks.transformRequest?.({ request, ir });

		expect(request.reasoning_effort).toBe("high");
	});

	it("adds billable orchestration tokens to normalized usage", () => {
		const response = {
			usage: {
				input_tokens: 120,
				output_tokens: 80,
				total_tokens: 245,
				input_tokens_details: {
					cached_tokens: 10,
					orchestration_input_tokens: 30,
					orchestration_input_cached_tokens: 5,
				},
				output_tokens_details: { orchestration_output_tokens: 15 },
			},
		};

		sakanaQuirks.normalizeResponse?.({ response, ir: {} as any });

		expect(response.usage).toMatchObject({
			input_tokens: 150,
			output_tokens: 95,
			total_tokens: 245,
			input_tokens_details: { cached_tokens: 15 },
		});
	});

	it("omits unsupported disabled reasoning effort", () => {
		const request: Record<string, unknown> = {
			reasoning: { effort: "none" },
		};
		const ir: any = {
			reasoning: {
				effort: "none",
			},
		};

		sakanaQuirks.transformRequest?.({ request, ir });

		expect(request.reasoning_effort).toBeUndefined();
		expect(request.reasoning).toBeUndefined();
	});
});
