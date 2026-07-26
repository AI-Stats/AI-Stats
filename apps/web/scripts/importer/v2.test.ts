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
} from "./v2";

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
