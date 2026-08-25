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
