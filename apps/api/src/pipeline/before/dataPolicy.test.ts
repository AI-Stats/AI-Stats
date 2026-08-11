import { describe, expect, it } from "vitest";
import { resolveEffectiveDataPolicy } from "./dataPolicy";
import type { GatewayProviderSnapshot } from "./types";

function provider(overrides: Partial<GatewayProviderSnapshot> = {}): GatewayProviderSnapshot {
    return {
        providerId: "openai",
        supportsEndpoint: true,
        baseWeight: 1,
        byokMeta: [],
        providerModelSlug: "gpt-5",
        dataPolicyTier: "private",
        dataPolicyConfidence: "confirmed",
        zeroDataRetention: "default",
        ...overrides,
    };
}

describe("resolveEffectiveDataPolicy", () => {
    it("inherits the provider policy for stateless inference", () => {
        expect(resolveEffectiveDataPolicy({ endpoint: "responses", provider: provider() })).toMatchObject({
            tier: "private",
            zdrEligibility: "eligible",
            source: "provider",
        });
    });

    it("does not classify batch as ZDR from the provider default", () => {
        expect(resolveEffectiveDataPolicy({ endpoint: "batch", provider: provider() })).toMatchObject({
            tier: "logs",
            zdrEligibility: "ineligible",
            retentionMode: "until_deleted",
            source: "capability_default",
        });
    });

    it("uses an explicit capability policy ahead of the conservative default", () => {
        const result = resolveEffectiveDataPolicy({
            endpoint: "batch",
            provider: provider({
                capabilityParams: {
                    data_policy: {
                        tier: "private",
                        confidence: "confirmed",
                        zdrEligibility: "eligible",
                        retentionMode: "none",
                        reason: "Covered by a custom upstream agreement.",
                    },
                },
            }),
        });
        expect(result).toMatchObject({
            tier: "private",
            zdrEligibility: "eligible",
            source: "capability",
        });
    });
});
