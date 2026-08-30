import { describe, expect, it } from "vitest";
import {
	classifyAutoRouterWorkload,
	applyAutoRouterHardRequirements,
	autoRouterSpendCaps,
	buildAutoRouterCandidateEvidence,
	buildAutoRouterClassifierRequestBody,
	matchesAutoRouterPattern,
	parseAutoRouterClassifierResponse,
	selectAutoRouterModel,
	type AutoRouterCandidateEvidence,
	type AutoRouterConfig,
	workspaceAutoRouterConfigFromRow,
} from "./auto-router";

function config(overrides: Partial<AutoRouterConfig> = {}): AutoRouterConfig {
	return { allowedModels: ["model/a", "model/b"], allowedPatterns: [], spendProfile: "standard", maxInputPricePerMillion: null, maxOutputPricePerMillion: null, candidateUniverseSize: 2, objective: "balanced", allowFallbacks: true, revision: "revision-1", ...overrides };
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

function provider(providerId: string, input: number | null, output: number | null): AutoRouterCandidateEvidence["providers"][number] {
	const rules = [
		...(input === null ? [] : [{ meter: "input_text_tokens", pricing_plan: "standard", price_per_unit: String(input), unit_size: 1_000_000 }]),
		...(output === null ? [] : [{ meter: "output_text_tokens", pricing_plan: "standard", price_per_unit: String(output), unit_size: 1_000_000 }]),
	];
	return {
		providerId,
		pricingCard: { rules },
	} as AutoRouterCandidateEvidence["providers"][number];
}

describe("auto router", () => {
	it("uses distinct spend ceilings and preserves exact custom limits", () => {
		expect(autoRouterSpendCaps(workspaceAutoRouterConfigFromRow({ auto_routing_spend_profile: "economy" }))).toEqual({ input: 0.1, output: 0.5 });
		expect(autoRouterSpendCaps(workspaceAutoRouterConfigFromRow({ auto_routing_spend_profile: "standard" }))).toEqual({ input: 0.3, output: 1.5 });
		expect(autoRouterSpendCaps(workspaceAutoRouterConfigFromRow({ auto_routing_spend_profile: "premium" }))).toEqual({ input: 1, output: 5 });
		expect(autoRouterSpendCaps(workspaceAutoRouterConfigFromRow({ auto_routing_spend_profile: "unrestricted" }))).toEqual({ input: null, output: null });
		expect(autoRouterSpendCaps(workspaceAutoRouterConfigFromRow({
			auto_routing_spend_profile: "custom",
			auto_routing_max_input_price_per_million: 0.42,
			auto_routing_max_output_price_per_million: 2.4,
		}))).toEqual({ input: 0.42, output: 2.4 });
	});

	it("normalizes the workspace configuration", () => {
		expect(workspaceAutoRouterConfigFromRow({
			auto_routing_allowed_patterns: ["Anthropic/*", "openai/gpt-*"],
			auto_routing_spend_profile: "premium",
			auto_routing_objective: "cost",
			auto_routing_fallbacks_enabled: false,
			auto_routing_revision: "revision-2",
		})).toEqual({
			allowedPatterns: ["anthropic/*", "openai/gpt-*"],
			spendProfile: "premium",
			maxInputPricePerMillion: null,
			maxOutputPricePerMillion: null,
			objective: "cost",
			allowFallbacks: false,
			revision: "revision-2",
		});
		expect(workspaceAutoRouterConfigFromRow(null)).toMatchObject({
			allowedPatterns: [],
			spendProfile: "standard",
			objective: "balanced",
			allowFallbacks: true,
			revision: "unknown",
		});
	});

	it("reapplies separate workspace spend caps to the providers used for execution", () => {
		const providers = [
			provider("within-cap", 0.2, 1),
			provider("over-input-cap", 0.4, 1),
			provider("over-output-cap", 0.2, 2),
			provider("missing-output-price", 0.2, null),
		];
		const result = buildAutoRouterCandidateEvidence({
			endpoint: "responses",
			requestedModel: "model/a",
			resolvedModel: "model/a",
			providers,
			contextResult: { ok: true, value: { providers, resolvedModel: "model/a" } },
			config: config(),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.evidence.providers.map((candidate) => candidate.providerId)).toEqual(["within-cap"]);
		const selectedContext = result.evidence.contextResult as { value: { providers: AutoRouterCandidateEvidence["providers"] } };
		expect(selectedContext.value.providers.map((candidate) => candidate.providerId)).toEqual(["within-cap"]);
	});

	it("fails closed when provider.only leaves only an over-cap route", () => {
		const result = buildAutoRouterCandidateEvidence({
			endpoint: "responses",
			requestedModel: "model/a",
			resolvedModel: "model/a",
			providers: [provider("requested-over-cap", 0.4, 2)],
			contextResult: { model: "model/a" },
			config: config(),
		});

		expect(result).toEqual({ ok: false, reason: "no_providers_within_spend_caps" });
	});

	it("fails closed when a standard-tier time window can exceed the cap", () => {
		const peakPriced = provider("peak-priced", 0.2, 1);
		peakPriced.pricingCard!.rules[0].time_windows = [{
			label: "peak",
			timezone: "UTC",
			start_time: "00:00",
			end_time: "23:59",
			price_per_unit: "0.6",
		}];
		const result = buildAutoRouterCandidateEvidence({
			endpoint: "responses",
			requestedModel: "model/a",
			resolvedModel: "model/a",
			providers: [peakPriced],
			contextResult: { model: "model/a" },
			config: config(),
		});

		expect(result).toEqual({ ok: false, reason: "no_providers_within_spend_caps" });
	});

	it("keeps non-standard service-tier prices outside the standard-tier ceiling", () => {
		const tiered = provider("tiered-provider", 0.2, 1);
		tiered.pricingCard!.rules.push({
			...tiered.pricingCard!.rules[0],
			pricing_plan: "priority",
			price_per_unit: "0.6",
		});
		const result = buildAutoRouterCandidateEvidence({
			endpoint: "responses",
			requestedModel: "model/a",
			resolvedModel: "model/a",
			providers: [tiered],
			contextResult: { model: "model/a" },
			config: config(),
		});

		expect(result.ok && result.evidence.providers.map((candidate) => candidate.providerId)).toEqual(["tiered-provider"]);
	});

	it("preserves all priced providers for an unrestricted workspace", () => {
		const result = buildAutoRouterCandidateEvidence({
			endpoint: "responses",
			requestedModel: "model/a",
			resolvedModel: "model/a",
			providers: [provider("premium-provider", 4, 20)],
			contextResult: { model: "model/a" },
			config: config({ spendProfile: "unrestricted" }),
		});

		expect(result.ok && result.evidence.providers.map((candidate) => candidate.providerId)).toEqual(["premium-provider"]);
	});

	it("matches exact and wildcard model restrictions", () => {
		expect(matchesAutoRouterPattern("anthropic/claude-sonnet-5", ["anthropic/*"])).toBe(true);
		expect(matchesAutoRouterPattern("openai/gpt-5.6-sol", ["openai/gpt-5.*"])).toBe(true);
		expect(matchesAutoRouterPattern("google/gemini-3.6-flash", ["anthropic/*", "openai/*"])).toBe(false);
		expect(matchesAutoRouterPattern("google/gemini-3.6-flash", [])).toBe(true);
	});

	it("classifies sensitive request text locally without retaining it in diagnostics", () => {
		const classified = classifyAutoRouterWorkload({
			messages: [{ role: "user", content: "Refactor this TypeScript function and debug the compiler error" }],
		});
		expect(classified).toEqual({ workload: "code", signals: ["code_terms"] });
		expect(JSON.stringify(classified)).not.toContain("compiler error");
	});

	it("builds and validates a bounded structured classifier request", () => {
		const request = buildAutoRouterClassifierRequestBody({
			model: "phaseo/auto",
			input: "Refactor this TypeScript parser and explain the trade-offs",
			response_format: { type: "json_object" },
		}, "responses") as any;
		expect(request).toMatchObject({
			model: "google/gemini-2.5-flash-lite",
			stream: false,
			store: false,
			max_output_tokens: 220,
			text: { format: { type: "json_schema", strict: true } },
		});
		expect(request.input[1].content[0].text).toContain('"has_structured_output":true');

		const parsed = parseAutoRouterClassifierResponse({
			output_text: JSON.stringify({
				primary_workload: "code",
				workloads: [{ workload: "code", weight: 8 }, { workload: "reasoning", weight: 2 }],
				complexity: 0.72,
				confidence: 0.9,
			}),
		});
		expect(parsed).toMatchObject({
			primaryWorkload: "code",
			complexity: 0.72,
			confidence: 0.9,
			source: "llm",
			workloads: [{ workload: "code", weight: 0.5 }, { workload: "reasoning", weight: 0.5 }],
		});
		expect(parseAutoRouterClassifierResponse({ output_text: "not json" })).toBeNull();
	});

	it("extracts text from nested Responses input items", () => {
		const request = buildAutoRouterClassifierRequestBody({
			input: [{
				role: "user",
				content: [{ type: "input_text", text: "Refactor this nested TypeScript parser" }],
			}],
		}, "responses") as any;
		expect(request.input[1].content[0].text).toContain("Refactor this nested TypeScript parser");
		expect(classifyAutoRouterWorkload({
			input: [{ role: "user", content: [{ type: "input_text", text: "Debug this TypeScript compiler" }] }],
		}).workload).toBe("code");
	});

	it("loads the canonical structured-output benchmark IDs", async () => {
		let requestedBenchmarkIds: string[] = [];
		await selectAutoRouterModel({
			endpoint: "responses",
			body: { input: "Return structured JSON", response_format: { type: "json_object" } },
			config: config({ allowedModels: ["model/a"] }),
			loadCandidate: async (model) => ({ ok: true, evidence: evidence(model) }),
			loadBenchmarks: async (_models, benchmarkIds) => {
				requestedBenchmarkIds = benchmarkIds;
				return [];
			},
		});
		expect(requestedBenchmarkIds).toContain("internal-api-instruction-following-(hard)");
	});

	it("keeps trusted tool and structured-output requirements authoritative", () => {
		const classified = parseAutoRouterClassifierResponse({
			output_text: JSON.stringify({
				primary_workload: "general",
				workloads: [{ workload: "general", weight: 1 }],
				complexity: 0.3,
				confidence: 0.8,
			}),
		})!;
		expect(applyAutoRouterHardRequirements({ tools: [{ name: "lookup" }] }, classified)).toMatchObject({
			primaryWorkload: "tool_use",
			workloads: [
				{ workload: "tool_use", weight: 0.6 },
				{ workload: "general", weight: 0.4 },
			],
			signals: ["llm_classifier", "tools"],
		});
		expect(applyAutoRouterHardRequirements({ response_format: { type: "json_object" } }, classified).primaryWorkload).toBe("structured");
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

	it("uses classified complexity to retain a capability margin over the cheapest model", async () => {
		const candidates = new Map([
			["model/cheap", evidence("model/cheap", { priceUsdPerMillionTokens: 1 })],
			["model/strong", evidence("model/strong", { priceUsdPerMillionTokens: 50 })],
		]);
		const result = await selectAutoRouterModel({
			endpoint: "responses",
			body: { input: "Solve the difficult task" },
			config: config({ allowedModels: [...candidates.keys()], objective: "cost" }),
			classification: {
				primaryWorkload: "reasoning",
				workloads: [{ workload: "reasoning", weight: 1 }],
				complexity: 0.9,
				confidence: 1,
				signals: ["llm_classifier"],
				source: "llm",
				classifierModel: "google/gemini-2.5-flash-lite",
			},
			loadCandidate: async (model) => ({ ok: true, evidence: candidates.get(model)! }),
			loadBenchmarks: async () => [
				{ model_slug: "model/cheap", benchmark_id: "gpqa-diamond", score_numeric: 20 },
				{ model_slug: "model/strong", benchmark_id: "gpqa-diamond", score_numeric: 90 },
			],
		});
		expect(result.ok && result.evaluation.selectedModel).toBe("model/strong");
		expect(result.ok && result.evaluation.candidates[0]?.factors.capabilityFit).toBe(1);
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
