import { describe, expect, it } from "vitest";
import { contextSchema } from "./schemas";

describe("contextSchema provider quantization metadata", () => {
	it("preserves route-level quantization metadata on the provider offer", () => {
		const parsed = contextSchema.parse({
			workspace_id: "ws_quantization",
			resolved_model: "meta/llama-3.3-70b-instruct",
			key_ok: { ok: true, reason: null },
			key_limit_ok: { ok: true, reason: null },
			credit_ok: { ok: true, reason: null },
			providers: [{
				provider_id: "deepinfra",
				provider_model_slug: "meta-llama/Llama-3.3-70B-Instruct",
				quantization_scheme: "FP8",
			}],
			pricing: {},
		});

		expect(parsed.providers[0]?.quantizationScheme).toBe("FP8");
	});
});

describe("contextSchema workspace budget metadata", () => {
	it("normalizes lifetime budget status without rejecting the gateway context", () => {
		const parsed = contextSchema.parse({
			workspace_id: "ws_budget",
			key_ok: { ok: true, reason: null },
			key_limit_ok: {
				ok: false,
				reason: "workspace_lifetime_cost_budget_reached",
				limit_window: "lifetime",
				limit_metric: "cost",
				budgets: [{ id: "budget_1", interval: "lifetime", limit_nanos: 10, usage_nanos: 10, remaining_nanos: 0, projected_usage_nanos: 10, exceeded: true, window_start: null, reset_at: null }],
			},
			credit_ok: { ok: true, reason: null },
			providers: [],
			pricing: {},
		});
		expect(parsed.keyLimit.limitWindow).toBe("lifetime");
		expect(parsed.keyLimit.budgets).toEqual([expect.objectContaining({ id: "budget_1", exceeded: true })]);
	});
});
