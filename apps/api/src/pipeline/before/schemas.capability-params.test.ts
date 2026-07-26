import { describe, expect, it } from "vitest";
import { providerSchema } from "./schemas";

describe("providerSchema capability params", () => {
    it("preserves the legacy object representation", () => {
        const parsed = providerSchema.parse({
            provider_id: "openai",
            capability_params: {
                temperature: {},
                reasoning: { style: "effort" },
            },
        });

        expect(parsed.capabilityParams).toEqual({
            temperature: {},
            reasoning: { style: "effort" },
        });
    });

    it("normalizes descriptor arrays returned by generic text capabilities", () => {
        const parsed = providerSchema.parse({
            provider_id: "openai",
            capability_params: [
                {
                    param_id: "max_tokens",
                    provider_min: null,
                    provider_max: 128_000,
                },
                {
                    param_id: "reasoning.mode",
                    values: ["standard", "pro"],
                    provider_default: "standard",
                },
            ],
        });

        expect(parsed.capabilityParams).toEqual({
            max_tokens: {
                provider_min: null,
                provider_max: 128_000,
            },
            "reasoning.mode": {
                values: ["standard", "pro"],
                provider_default: "standard",
            },
        });
    });

    it("ignores descriptor entries without a parameter id", () => {
        const parsed = providerSchema.parse({
            provider_id: "openai",
            capability_params: [{ provider_default: null }],
        });

        expect(parsed.capabilityParams).toEqual({});
    });
});
