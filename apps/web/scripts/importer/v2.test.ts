jest.mock("./paths", () => ({
    DATA_ROOT: "",
    DIR_ALIASES: "",
}));

import {
    isFreeModelVariant,
    mergeProviderModels,
    preflightV2Benchmarks,
    preflightV2Models,
    pricingModelPart,
    v2RouteModelSlug,
    v2RouteExecutionRegions,
    validateJsonPricingRules,
    routeStatus,
    staleJsonProviderRouteIds,
    staleOwnedModelChildRows,
} from "./v2";

describe("V2 child reconciliation", () => {
    it("removes repository-owned notices that disappeared from JSON", () => {
        expect(staleOwnedModelChildRows(
            [
                { model_slug: "moonshotai/kimi-k3" },
                { model_slug: "external/model" },
            ],
            [],
            new Set(["moonshotai/kimi-k3"]),
            ["model_slug"],
        )).toEqual([{ model_slug: "moonshotai/kimi-k3" }]);
    });

    it("removes stale links and details while preserving desired identities", () => {
        expect(staleOwnedModelChildRows(
            [
                { model_slug: "lab/model", link_kind: "docs", url: "https://old.example" },
                { model_slug: "lab/model", link_kind: "weights", url: "https://weights.example" },
            ],
            [
                { model_slug: "lab/model", link_kind: "docs", url: "https://new.example" },
                { model_slug: "lab/model", link_kind: "weights", url: "https://weights.example" },
            ],
            new Set(["lab/model"]),
            ["model_slug", "link_kind", "url"],
        )).toEqual([
            { model_slug: "lab/model", link_kind: "docs", url: "https://old.example" },
        ]);
    });
});

describe("V2 provider route reconciliation", () => {
    it("deletes only stale importer-owned routes", () => {
        expect(staleJsonProviderRouteIds(
            [
                { provider_model_id: "provider:active", metadata: { source: "json" } },
                { provider_model_id: "provider:disabled", metadata: { source: "json" } },
                { provider_model_id: "provider:stale", metadata: { source: "models.dev" } },
                { provider_model_id: "provider:unresolved", metadata: { source: "json" } },
                { provider_model_id: "provider:manual", metadata: { source: "manual" } },
            ],
            new Set(["provider:active", "provider:disabled"]),
            new Set(["provider:unresolved"]),
        )).toEqual(["provider:stale"]);
    });
});

describe("free model variants", () => {
    it("uses the canonical base identity for a free provider route", () => {
        expect(v2RouteModelSlug(
            {
                api_model_id: "z-ai/glm-4-7-flash:free",
                internal_model_id: "z-ai/glm-4.7-flash",
            },
            (value) => String(value),
            { canonical_model_id: "z-ai/glm-4.7-flash:free" },
        )).toBe("z-ai/glm-4.7-flash:free");
    });

    it("does not add the suffix twice", () => {
        expect(v2RouteModelSlug(
            { api_model_id: "poolside/laguna-s-2.1:free", model_id: "poolside/laguna-s-2.1:free" },
            (value) => String(value),
            { canonical_model_id: "poolside/laguna-s-2.1:free" },
        )).toBe("poolside/laguna-s-2.1:free");
    });

    it("rejects a free route whose canonical variant is absent from JSON", () => {
        expect(() => v2RouteModelSlug(
            { api_model_id: "poolside/laguna-s-2.1:free", model_id: "poolside/laguna-s-2.1" },
            (value) => String(value),
        )).toThrow("missing authored canonical_model_id");
        expect(isFreeModelVariant("poolside/laguna-s-2.1:FREE")).toBe(true);
    });
});

describe("routeStatus", () => {
    it("defaults an authored active gateway route to active", () => {
        expect(routeStatus(null, true)).toBe("active");
    });

    it("keeps an explicit disabled status authoritative", () => {
        expect(routeStatus("disabled", true)).toBe("disabled");
    });
});

describe("v2RouteExecutionRegions", () => {
    it("prefers model-specific execution regions over provider defaults", () => {
        expect(v2RouteExecutionRegions(
            ["global"],
            { regions: { execution: ["EU-NORTH1"] } },
        )).toEqual(["eu-north1"]);
    });

    it("falls back to provider defaults when a model has no execution regions", () => {
        expect(v2RouteExecutionRegions(["US", "us"], { regions: { execution: null } }))
            .toEqual(["us"]);
    });
});

describe("mergeProviderModels", () => {
    it("keeps authored-only routes and lets JSON override legacy fields", () => {
        const rows = mergeProviderModels(
            [{
                provider_api_model_id: "provider:lab/model",
                routing_status: "disabled",
                legacy_only: true,
            }],
            new Map([
                ["provider:lab/model", {
                    provider_api_model_id: "provider:lab/model",
                    routing_status: "active",
                }],
                ["provider:lab/model:free", {
                    provider_api_model_id: "provider:lab/model:free",
                    canonical_model_id: "lab/model:free",
                }],
            ]),
        );

        expect(rows).toHaveLength(2);
        expect(rows).toContainEqual(expect.objectContaining({
            provider_api_model_id: "provider:lab/model",
            routing_status: "active",
            legacy_only: true,
        }));
        expect(rows).toContainEqual(expect.objectContaining({
            provider_api_model_id: "provider:lab/model:free",
            canonical_model_id: "lab/model:free",
        }));
    });
});

describe("pricingModelPart", () => {
    it.each([
        "mindai/macaron-v1-venti:free",
        "inclusionai/ling-3.0-flash:free",
    ])("preserves the %s variant when removing the capability suffix", (apiModelId) => {
        expect(pricingModelPart(`novita:${apiModelId}:text.generate`)).toEqual({
            providerSlug: "novita",
            apiModelId,
        });
    });

    it("parses standard model keys", () => {
        expect(pricingModelPart("openai:openai/gpt-5:text.generate")).toEqual({
            providerSlug: "openai",
            apiModelId: "openai/gpt-5",
        });
    });
});

describe("validateJsonPricingRules", () => {
    const baseRule = {
        model_key: "anthropic:anthropic/claude-3-opus:text.generate",
        capability_id: "text.generate",
        pricing_plan: "batch",
        meter: "output_text_tokens",
        unit: "token",
        unit_size: 1_000_000,
        currency: "USD",
        match: [],
        priority: 100,
    };

    it("accepts multiple meters on one offer", () => {
        expect(() => validateJsonPricingRules([
            { ...baseRule, source_key: "input", meter: "input_text_tokens", price_per_unit: 7.5 },
            { ...baseRule, source_key: "output", price_per_unit: 37.5 },
        ])).not.toThrow();
    });

    it("rejects two prices for the same offer and meter", () => {
        expect(() => validateJsonPricingRules([
            { ...baseRule, source_key: "wrong", price_per_unit: 2 },
            { ...baseRule, source_key: "correct", price_per_unit: 37.5 },
        ])).toThrow("Conflicting JSON pricing rates");
    });
});

describe("preflightV2Models", () => {
    it("canonicalizes authored legacy aliases without mutating the legacy row", () => {
        const legacyRow = {
            model_id: "nousresearch/hermes-3-llama-3.1-405b",
            organisation_id: "nous",
            name: "Hermes 3 Llama 3.1 405b",
        };

        const result = preflightV2Models(
            [legacyRow],
            new Map([["nousresearch/hermes-3-llama-3.1-405b", "nous/hermes-3-llama-3.1-405b"]]),
        );

        expect(result.models).toEqual([{ ...legacyRow, model_id: "nous/hermes-3-llama-3.1-405b" }]);
        expect(result.modelSlugAliases.get("nousresearch/hermes-3-llama-3.1-405b")).toBe("nous/hermes-3-llama-3.1-405b");
        expect(result.issues).toEqual([]);
        expect(legacyRow.model_id).toBe("nousresearch/hermes-3-llama-3.1-405b");
    });

    it("excludes an invalid legacy identity and records a deterministic issue", () => {
        const result = preflightV2Models(
            [{ model_id: "unknown/model", organisation_id: "nous" }],
            new Map(),
        );

        expect(result.models).toEqual([]);
        expect(result.issues).toEqual([expect.objectContaining({
            source_type: "v2_model_preflight",
            source_key: "unknown/model",
            issue_code: "unresolved_model_slug_prefix",
        })]);
    });

    it("keeps the canonical row when both legacy and canonical identities exist", () => {
        const canonicalRow = { model_id: "nous/hermes-3-llama-3.1-405b", organisation_id: "nous", name: "Canonical" };
        const legacyRow = { model_id: "nousresearch/hermes-3-llama-3.1-405b", organisation_id: "nous", name: "Legacy" };

        const result = preflightV2Models(
            [canonicalRow, legacyRow],
            new Map([[legacyRow.model_id, canonicalRow.model_id]]),
        );

        expect(result.models).toEqual([canonicalRow]);
        expect(result.issues[0]).toEqual(expect.objectContaining({ issue_code: "canonical_model_duplicate" }));
    });

    it("maps benchmark results through the canonical model identity", () => {
        const result = preflightV2Benchmarks(
            [{ id: "result-1", model_id: "legacy/model", benchmark_id: "arc-agi-3", score: "50" }],
            new Set(["arc-agi-3"]),
            new Set(["nous/model"]),
            (value) => value === "legacy/model" ? "nous/model" : String(value),
        );

        expect(result.rows).toEqual([expect.objectContaining({ result_id: "result-1", model_slug: "nous/model" })]);
        expect(result.issues).toEqual([]);
    });
});
