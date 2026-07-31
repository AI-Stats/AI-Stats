import { describe, expect, it } from "vitest";
import {
	applyProviderQualifiedModelConstraint,
	canonicalizeProviderQualifiedModelRequest,
	filterProviderQualifiedModelCandidates,
	parseProviderQualifiedModel,
} from "./requestRouting";

function candidate(args: {
	providerId: string;
	pricing?: "free" | "paid" | "missing";
}) {
	return {
		providerId: args.providerId,
		adapter: { name: args.providerId },
		baseWeight: 1,
		byokMeta: [],
		providerModelSlug: "upstream/model",
		pricingCard:
			args.pricing === "missing"
				? null
				: {
					provider: args.providerId,
					model: "publisher/model:free",
					endpoint: "responses",
					effective_from: null,
					effective_to: null,
					currency: "USD",
					version: null,
					rules: [{
						pricing_plan:
							args.pricing === "free" ? "free" : "standard",
						meter: "input_tokens",
						unit: "token",
						unit_size: 1,
						price_per_unit:
							args.pricing === "free" ? "0" : "0.000001",
						currency: "USD",
						match: [],
						priority: 100,
					}],
				},
	} as any;
}

describe("provider-qualified model ids", () => {
	it("parses an exact provider-model pair", () => {
		expect(
			parseProviderQualifiedModel(
				"Baseten:thinking-machines/inkling-small",
			),
		).toEqual({
			providerId: "baseten",
			model: "thinking-machines/inkling-small",
		});
	});

	it("preserves canonical model suffixes", () => {
		expect(
			parseProviderQualifiedModel(
				"baseten:google/gemma-4-26b-a4b:free",
			),
		).toEqual({
			providerId: "baseten",
			model: "google/gemma-4-26b-a4b:free",
		});
	});

	it("does not interpret canonical suffixes as provider qualifiers", () => {
		expect(
			parseProviderQualifiedModel("google/gemma-4-26b-a4b:free"),
		).toBeNull();
		expect(parseProviderQualifiedModel("phaseo/free")).toBeNull();
	});

	it("canonicalizes the model without mutating the input body", () => {
		const body = {
			model: "deepinfra:deepseek/deepseek-v3",
			input: "Hello",
		};
		const result = canonicalizeProviderQualifiedModelRequest(body);
		expect(result.body).not.toBe(body);
		expect(result.body.model).toBe("deepseek/deepseek-v3");
		expect(body.model).toBe("deepinfra:deepseek/deepseek-v3");
	});

	it("applies the provider as an exact constraint", () => {
		const canonical = canonicalizeProviderQualifiedModelRequest({
			model: "baseten:thinking-machines/inkling-small",
			routing: { mode: "latency" },
		});
		const result = applyProviderQualifiedModelConstraint(
			canonical.body,
			canonical.selection,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.body.provider.only).toEqual(["baseten"]);
		expect(result.body.routing.only).toEqual(["baseten"]);
		expect(result.body.routing.mode).toBe("latency");
	});

	it("accepts a matching explicit provider allowlist", () => {
		const canonical = canonicalizeProviderQualifiedModelRequest({
			model: "baseten:thinking-machines/inkling-small",
			provider: { only: ["BASETEN"] },
		});
		const result = applyProviderQualifiedModelConstraint(
			canonical.body,
			canonical.selection,
		);
		expect(result.ok).toBe(true);
	});

	it("normalizes provider aliases consistently with provider.only", () => {
		const canonical = canonicalizeProviderQualifiedModelRequest({
			model: "NovitaAI:deepseek/deepseek-v3",
			provider: { only: ["novita-ai"] },
		});
		expect(canonical.selection?.providerId).toBe("novita");
		const result = applyProviderQualifiedModelConstraint(
			canonical.body,
			canonical.selection,
		);
		expect(result.ok).toBe(true);
	});

	it("rejects a contradictory provider allowlist", () => {
		const canonical = canonicalizeProviderQualifiedModelRequest({
			model: "baseten:thinking-machines/inkling-small",
			provider: { only: ["deepinfra"] },
		});
		expect(
			applyProviderQualifiedModelConstraint(
				canonical.body,
				canonical.selection,
			),
		).toMatchObject({
			ok: false,
			field: "provider.only",
			providerId: "baseten",
		});
	});

	it("rejects a routing ignore list containing the qualifier", () => {
		const canonical = canonicalizeProviderQualifiedModelRequest({
			model: "baseten:thinking-machines/inkling-small",
			routing: { ignore: ["baseten"] },
		});
		expect(
			applyProviderQualifiedModelConstraint(
				canonical.body,
				canonical.selection,
			),
		).toMatchObject({
			ok: false,
			field: "routing.ignore",
			providerId: "baseten",
		});
	});

	it("rejects a provider that is absent for the exact model", () => {
		const selection = parseProviderQualifiedModel(
			"baseten:publisher/model:free",
		);
		expect(
			filterProviderQualifiedModelCandidates(
				[candidate({ providerId: "deepinfra", pricing: "free" })],
				selection,
			),
		).toMatchObject({
			ok: false,
			reason: "qualified_provider_unavailable",
			providerId: "baseten",
			model: "publisher/model:free",
		});
	});

	it("rejects paid pricing for a provider-qualified free model", () => {
		const selection = parseProviderQualifiedModel(
			"baseten:publisher/model:free",
		);
		expect(
			filterProviderQualifiedModelCandidates(
				[candidate({ providerId: "baseten", pricing: "paid" })],
				selection,
			),
		).toMatchObject({
			ok: false,
			reason: "qualified_free_provider_unavailable",
		});
	});

	it("rejects missing pricing for a provider-qualified free model", () => {
		const selection = parseProviderQualifiedModel(
			"baseten:publisher/model:free",
		);
		expect(
			filterProviderQualifiedModelCandidates(
				[candidate({ providerId: "baseten", pricing: "missing" })],
				selection,
			),
		).toMatchObject({
			ok: false,
			reason: "qualified_free_provider_unavailable",
		});
	});

	it("accepts only the requested provider when its free route is valid", () => {
		const selection = parseProviderQualifiedModel(
			"baseten:publisher/model:free",
		);
		const result = filterProviderQualifiedModelCandidates(
			[
				candidate({ providerId: "baseten", pricing: "free" }),
				candidate({ providerId: "deepinfra", pricing: "free" }),
			],
			selection,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.providers.map((provider) => provider.providerId)).toEqual([
			"baseten",
		]);
	});

	it("does not require free pricing for a qualified paid model", () => {
		const selection = parseProviderQualifiedModel(
			"baseten:publisher/model",
		);
		const result = filterProviderQualifiedModelCandidates(
			[candidate({ providerId: "baseten", pricing: "paid" })],
			selection,
		);
		expect(result.ok).toBe(true);
	});
});
