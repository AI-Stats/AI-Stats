import { describe, expect, it } from "vitest";
import {
	classifyAutoRouterWorkload,
	selectAutoRouterModel,
	type AutoRouterCandidateEvidence,
	type AutoRouterConfig,
	workspaceAutoRouterConfigFromRow,
} from "./auto-router";

function config(overrides: Partial<AutoRouterConfig> = {}): AutoRouterConfig {
	return { allowedModels: ["model/a", "model/b"], objective: "balanced", allowFallbacks: true, revision: "revision-1", ...overrides };
}

function evidence(model: string, overrides: Partial<AutoRouterCandidateEvidence> = {}): AutoRouterCandidateEvidence {
	return {
		requestedModel: model,
		resolvedModel: model,
		providers: [{ providerId: `${model}-provider` } as AutoRouterCandidateEvidence["providers"][number]],
		priceUsdPerMillionTokens: 10,
		latencyMs: 500,
		reliability: 0.99,
		contextResult: { model },
		...overrides,
	};
}

describe("auto router", () => {
	it("normalizes the enabled workspace configuration", () => {
		expect(workspaceAutoRouterConfigFromRow({
			auto_routing_enabled: true,
			auto_routing_model_ids: ["model/a", "model/a", "phaseo/auto", "model/b"],
			auto_routing_objective: "cost",
			auto_routing_fallbacks_enabled: false,
			auto_routing_revision: "revision-2",
		})).toEqual({
			allowedModels: ["model/a", "model/b"],
			objective: "cost",
			allowFallbacks: false,
			revision: "revision-2",
		});
		expect(workspaceAutoRouterConfigFromRow({ auto_routing_enabled: false })).toBeNull();
	});

	it("classifies sensitive request text locally without retaining it in diagnostics", () => {
		const classified = classifyAutoRouterWorkload({
			messages: [{ role: "user", content: "Refactor this TypeScript function and debug the compiler error" }],
		});
		expect(classified).toEqual({ workload: "code", signals: ["code_terms"] });
		expect(JSON.stringify(classified)).not.toContain("compiler error");
	});

	it("ranks relevant benchmark quality with operational and price evidence", async () => {
		const candidates = new Map([
			["model/cheap", evidence("model/cheap", { priceUsdPerMillionTokens: 1, latencyMs: 300, reliability: 0.98 })],
			["model/strong", evidence("model/strong", { priceUsdPerMillionTokens: 20, latencyMs: 600, reliability: 0.99 })],
		]);
		const result = await selectAutoRouterModel({
			endpoint: "responses",
			body: { input: "Prove this theorem and derive the equation" },
			config: config({ allowedModels: [...candidates.keys()], objective: "quality" }),
			loadCandidate: async (model) => ({ ok: true, evidence: candidates.get(model)! }),
			loadBenchmarks: async () => [
				{ model_slug: "model/cheap", benchmark_id: "gpqa-diamond", score_numeric: 40 },
				{ model_slug: "model/strong", benchmark_id: "gpqa-diamond", score_numeric: 80 },
			],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.evaluation.workload).toBe("reasoning");
		expect(result.evaluation.configRevision).toBe("revision-1");
		expect(result.evaluation.selectedModel).toBe("model/strong");
		expect(result.evaluation.fallbackModels).toEqual(["model/cheap"]);
		expect(result.evaluation.candidates[0]).toMatchObject({
			model: "model/strong",
			reason: "selected",
			benchmarkIds: ["gpqa-diamond"],
		});
	});

	it("lets a cost objective prefer a cheaper eligible model", async () => {
		const candidates = new Map([
			["model/cheap", evidence("model/cheap", { priceUsdPerMillionTokens: 1 })],
			["model/expensive", evidence("model/expensive", { priceUsdPerMillionTokens: 50 })],
		]);
		const result = await selectAutoRouterModel({
			endpoint: "chat.completions",
			body: { messages: [{ role: "user", content: "Hello" }] },
			config: config({ allowedModels: [...candidates.keys()], objective: "cost", allowFallbacks: false }),
			loadCandidate: async (model) => ({ ok: true, evidence: candidates.get(model)! }),
			loadBenchmarks: async () => [],
		});

		expect(result.ok && result.evaluation.selectedModel).toBe("model/cheap");
		expect(result.ok && result.evaluation.fallbackModels).toEqual([]);
	});

	it("excludes unavailable and policy-blocked models before scoring", async () => {
		const result = await selectAutoRouterModel({
			endpoint: "messages",
			body: { messages: [{ role: "user", content: "Use this tool" }], tools: [{ name: "lookup" }] },
			config: config({ allowedModels: ["model/blocked", "model/live"] }),
			loadCandidate: async (model) => model === "model/blocked"
				? { ok: false, reason: "model_restricted_by_policy" }
				: { ok: true, evidence: evidence(model) },
			loadBenchmarks: async () => [],
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.evaluation.selectedModel).toBe("model/live");
		expect(result.evaluation.candidates).toContainEqual(expect.objectContaining({
			model: "model/blocked",
			eligible: false,
			reason: "model_restricted_by_policy",
		}));
	});

	it("fails closed when no allow-listed model is eligible", async () => {
		const result = await selectAutoRouterModel({
			endpoint: "responses",
			body: { input: "hello" },
			config: config(),
			loadCandidate: async () => ({ ok: false, reason: "all_providers_unavailable" }),
		});

		expect(result).toMatchObject({ ok: false, reason: "no_eligible_models" });
	});

	it("degrades a benchmark outage to neutral quality without widening eligibility", async () => {
		const result = await selectAutoRouterModel({
			endpoint: "responses",
			body: { input: "hello" },
			config: config(),
			loadCandidate: async (model) => ({ ok: true, evidence: evidence(model) }),
			loadBenchmarks: async () => { throw new Error("catalogue unavailable"); },
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.evaluation.benchmarkDataStatus).toBe("unavailable");
		expect(result.evaluation.candidates.every((candidate) => candidate.factors.quality === 0.5)).toBe(true);
	});

	it("only accepts an operational fallback from the original allow-list", async () => {
		const result = await selectAutoRouterModel({
			endpoint: "responses",
			body: { input: "hello" },
			config: config(),
			modelOverride: "model/outside",
			loadCandidate: async (model) => ({ ok: true, evidence: evidence(model) }),
		});
		expect(result).toEqual({ ok: false, reason: "invalid_override", candidates: [] });
	});
});
