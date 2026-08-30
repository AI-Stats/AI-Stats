import type { Endpoint } from "@core/types";
import type { PriceCard } from "../pricing/types";
import type { ProviderCandidate } from "./types";
import { getSupabaseAdmin } from "@/runtime/env";
import { readHealthManyOptimistic } from "../execute/health";

export const AUTO_ROUTER_MODEL_ID = "phaseo/auto";
export const AUTO_ROUTER_ALGORITHM_VERSION = "auto-router-v1";

export type AutoRouterObjective = "balanced" | "quality" | "cost" | "latency";
export type AutoRouterWorkload =
	| "code"
	| "reasoning"
	| "tool_use"
	| "structured"
	| "translation"
	| "summarization"
	| "general";

export type AutoRouterConfig = {
	allowedModels: string[];
	objective: AutoRouterObjective;
	allowFallbacks: boolean;
};

export type AutoRouterCandidateEvidence = {
	requestedModel: string;
	resolvedModel: string;
	providers: ProviderCandidate[];
	priceUsdPerMillionTokens: number | null;
	latencyMs: number | null;
	reliability: number;
	contextResult: unknown;
};

export type AutoRouterBenchmarkResult = {
	model_slug: string;
	benchmark_id: string;
	score_numeric: number | string | null;
};

export type AutoRouterCandidateDiagnostic = {
	model: string;
	resolvedModel: string | null;
	eligible: boolean;
	reason: string | null;
	score: number | null;
	factors: {
		quality: number | null;
		cost: number | null;
		latency: number | null;
		reliability: number | null;
	};
	benchmarkIds: string[];
	providerCount: number;
};

export type AutoRouterEvaluation = {
	algorithm: typeof AUTO_ROUTER_ALGORITHM_VERSION;
	workload: AutoRouterWorkload;
	objective: AutoRouterObjective;
	selectedModel: string;
	selectedResolvedModel: string;
	overriddenByDynamicRoute: string | null;
	fallbackModels: string[];
	benchmarkSource: "phaseo_catalog";
	benchmarkDataAvailable: boolean;
	benchmarkDataStatus: "available" | "no_matches" | "unavailable" | "skipped_for_fallback";
	classificationSignals: string[];
	candidates: AutoRouterCandidateDiagnostic[];
};

type CandidateLoadResult =
	| { ok: true; evidence: AutoRouterCandidateEvidence }
	| { ok: false; reason: string };

type SelectAutoRouterArgs = {
	endpoint: Endpoint;
	body: any;
	config: AutoRouterConfig;
	modelOverride?: string | null;
	loadCandidate: (model: string) => Promise<CandidateLoadResult>;
	loadBenchmarks?: (models: string[], benchmarkIds: string[]) => Promise<AutoRouterBenchmarkResult[]>;
};

export type SelectAutoRouterResult =
	| { ok: true; evaluation: AutoRouterEvaluation; selected: AutoRouterCandidateEvidence }
	| { ok: false; reason: "invalid_override" | "no_eligible_models"; candidates: AutoRouterCandidateDiagnostic[] };

const OBJECTIVES = new Set<AutoRouterObjective>(["balanced", "quality", "cost", "latency"]);
const TEXT_ENDPOINTS = new Set<Endpoint>(["responses", "chat.completions", "messages"]);
const MAX_ALLOWED_MODELS = 8;
const MAX_CLASSIFICATION_CHARS = 16_384;
function isProhibitedAutoRouterBenchmark(id: string): boolean {
	return id.startsWith("aa-") || id === "artificial-analysis";
}

const BENCHMARKS_BY_WORKLOAD: Record<AutoRouterWorkload, string[]> = {
	code: ["swe-bench", "aider-polyglot", "livecodebench"],
	reasoning: ["gpqa-diamond", "aime-2025", "math-500"],
	tool_use: ["bfcl-v4", "bfcl-v3-multiturn", "tau-bench"],
	structured: ["if-eval", "multi-if", "internal-api-instruction-following--hard-"],
	translation: ["mgsm", "mmlu-multilingual", "global-mmlu-lite"],
	summarization: ["longbench-v2", "govreport", "if-eval"],
	general: ["lmarena-text", "arena-hard-v2", "if-eval"],
};

const WEIGHTS: Record<AutoRouterObjective, { quality: number; cost: number; latency: number; reliability: number }> = {
	balanced: { quality: 0.45, reliability: 0.25, latency: 0.15, cost: 0.15 },
	quality: { quality: 0.70, reliability: 0.15, latency: 0.05, cost: 0.10 },
	cost: { quality: 0.25, reliability: 0.20, latency: 0.10, cost: 0.45 },
	latency: { quality: 0.25, reliability: 0.25, latency: 0.40, cost: 0.10 },
};

function cleanModelList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value
		.map((item) => typeof item === "string" ? item.trim() : "")
		.filter((item) => item && item !== AUTO_ROUTER_MODEL_ID))]
		.slice(0, MAX_ALLOWED_MODELS);
}

export function isAutoRouterModel(model: string | null | undefined): boolean {
	return String(model ?? "").trim().toLowerCase() === AUTO_ROUTER_MODEL_ID;
}

export function parseAutoRouterConfig(body: any): AutoRouterConfig | null {
	const raw = body?.routing?.auto;
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const allowedModels = cleanModelList(raw.allowed_models ?? raw.allowedModels);
	const requestedObjective = String(raw.objective ?? "balanced").trim().toLowerCase() as AutoRouterObjective;
	return {
		allowedModels,
		objective: OBJECTIVES.has(requestedObjective) ? requestedObjective : "balanced",
		allowFallbacks: raw.allow_fallbacks !== false && raw.allowFallbacks !== false,
	};
}

function appendText(parts: string[], value: unknown) {
	if (typeof value === "string") parts.push(value);
	if (!Array.isArray(value)) return;
	for (const item of value) {
		if (typeof item === "string") parts.push(item);
		else if (item && typeof item === "object") {
			const record = item as Record<string, unknown>;
			if (typeof record.text === "string") parts.push(record.text);
			if (typeof record.content === "string") parts.push(record.content);
		}
	}
}

function requestText(body: any): string {
	const parts: string[] = [];
	appendText(parts, body?.input);
	for (const message of Array.isArray(body?.messages) ? body.messages : []) {
		appendText(parts, message?.content);
	}
	appendText(parts, body?.prompt);
	return parts.join("\n").slice(0, MAX_CLASSIFICATION_CHARS);
}

export function classifyAutoRouterWorkload(body: any): { workload: AutoRouterWorkload; signals: string[] } {
	const text = requestText(body);
	const lower = text.toLowerCase();
	const signals: string[] = [];
	if (Array.isArray(body?.tools) && body.tools.length > 0) signals.push("tools");
	if (body?.response_format || body?.responseFormat || body?.text?.format) signals.push("structured_output");
	if (/```|\b(function|class|typescript|javascript|python|rust|golang|sql|debug|refactor|codebase|compiler)\b/i.test(text)) signals.push("code_terms");
	if (/\b(translate|translation|traduc|übersetz|traduire)\b/i.test(text)) signals.push("translation_terms");
	if (/\b(summarize|summarise|summary|tl;dr|key points|condense)\b/i.test(text)) signals.push("summarization_terms");
	if (/\b(prove|derive|theorem|equation|calculate|reason step|logic puzzle|mathematical)\b/i.test(text)) signals.push("reasoning_terms");
	if (lower.length >= 8_000) signals.push("long_context");

	if (signals.includes("tools")) return { workload: "tool_use", signals };
	if (signals.includes("structured_output")) return { workload: "structured", signals };
	if (signals.includes("code_terms")) return { workload: "code", signals };
	if (signals.includes("translation_terms")) return { workload: "translation", signals };
	if (signals.includes("summarization_terms") || signals.includes("long_context")) return { workload: "summarization", signals };
	if (signals.includes("reasoning_terms")) return { workload: "reasoning", signals };
	return { workload: "general", signals: signals.length ? signals : ["default"] };
}

function round(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

function normalizeHigherIsBetter(values: Array<number | null>): Array<number | null> {
	const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
	if (!finite.length) return values.map(() => null);
	const min = Math.min(...finite);
	const max = Math.max(...finite);
	return values.map((value) => {
		if (value === null || !Number.isFinite(value)) return null;
		if (min === max) return 0.5;
		return (value - min) / (max - min);
	});
}

function normalizeLowerIsBetter(values: Array<number | null>): Array<number | null> {
	return normalizeHigherIsBetter(values).map((value) => value === null ? null : 1 - value);
}

function qualityScores(
	candidates: AutoRouterCandidateEvidence[],
	benchmarks: AutoRouterBenchmarkResult[],
	benchmarkIds: string[],
): { scores: number[]; usedIds: string[][] } {
	const totals = candidates.map(() => [] as number[]);
	const usedIds = candidates.map(() => [] as string[]);
	for (const benchmarkId of benchmarkIds) {
		const raw = candidates.map((candidate) => {
			const row = benchmarks.find((item) =>
				item.benchmark_id === benchmarkId &&
				(item.model_slug === candidate.resolvedModel || item.model_slug === candidate.requestedModel));
			if (row?.score_numeric === null || row?.score_numeric === undefined) return null;
			const value = Number(row.score_numeric);
			return Number.isFinite(value) ? value : null;
		});
		const normalized = normalizeHigherIsBetter(raw);
		normalized.forEach((value, index) => {
			if (value === null) return;
			totals[index].push(value);
			usedIds[index].push(benchmarkId);
		});
	}
	return {
		scores: totals.map((values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0.5),
		usedIds,
	};
}

function emptyCandidateDiagnostic(model: string, reason: string): AutoRouterCandidateDiagnostic {
	return {
		model,
		resolvedModel: null,
		eligible: false,
		reason,
		score: null,
		factors: { quality: null, cost: null, latency: null, reliability: null },
		benchmarkIds: [],
		providerCount: 0,
	};
}

export async function selectAutoRouterModel(args: SelectAutoRouterArgs): Promise<SelectAutoRouterResult> {
	if (!TEXT_ENDPOINTS.has(args.endpoint)) {
		return { ok: false, reason: "no_eligible_models", candidates: args.config.allowedModels.map((model) => emptyCandidateDiagnostic(model, "unsupported_endpoint")) };
	}
	if (args.modelOverride && !args.config.allowedModels.includes(args.modelOverride)) {
		return { ok: false, reason: "invalid_override", candidates: [] };
	}

	const models = args.modelOverride ? [args.modelOverride] : args.config.allowedModels;
	const loaded = await Promise.all(models.map(async (model) => ({ model, result: await args.loadCandidate(model) })));
	const rejected = loaded
		.filter((item): item is { model: string; result: Extract<CandidateLoadResult, { ok: false }> } => !item.result.ok)
		.map((item) => emptyCandidateDiagnostic(item.model, item.result.reason));
	const eligible = loaded
		.filter((item): item is { model: string; result: Extract<CandidateLoadResult, { ok: true }> } => item.result.ok)
		.map((item) => item.result.evidence);
	if (!eligible.length) return { ok: false, reason: "no_eligible_models", candidates: rejected };

	const classification = classifyAutoRouterWorkload(args.body);
	const benchmarkIds = BENCHMARKS_BY_WORKLOAD[classification.workload];
	let benchmarkRows: AutoRouterBenchmarkResult[] = [];
	let benchmarkDataStatus: AutoRouterEvaluation["benchmarkDataStatus"] = args.modelOverride
		? "skipped_for_fallback"
		: "no_matches";
	if (args.loadBenchmarks && !args.modelOverride) {
		try {
			benchmarkRows = await args.loadBenchmarks(
				eligible.flatMap((candidate) => [candidate.requestedModel, candidate.resolvedModel]),
				benchmarkIds,
			);
			benchmarkDataStatus = benchmarkRows.length ? "available" : "no_matches";
		} catch {
			benchmarkDataStatus = "unavailable";
		}
	}
	const quality = qualityScores(eligible, benchmarkRows, benchmarkIds);
	const costs = normalizeLowerIsBetter(eligible.map((candidate) => candidate.priceUsdPerMillionTokens));
	const latencies = normalizeLowerIsBetter(eligible.map((candidate) => candidate.latencyMs));
	const weights = WEIGHTS[args.config.objective];
	const ranked = eligible.map((candidate, index) => {
		const factors = {
			quality: quality.scores[index],
			cost: costs[index] ?? 0.5,
			latency: latencies[index] ?? 0.5,
			reliability: Math.max(0, Math.min(1, candidate.reliability)),
		};
		const score = factors.quality * weights.quality + factors.cost * weights.cost + factors.latency * weights.latency + factors.reliability * weights.reliability;
		return { candidate, factors, score, benchmarkIds: quality.usedIds[index], allowlistIndex: args.config.allowedModels.indexOf(candidate.requestedModel) };
	}).sort((left, right) => right.score - left.score || left.allowlistIndex - right.allowlistIndex);

	const winner = ranked[0];
	const fallbackModels = args.config.allowFallbacks && !args.modelOverride
		? ranked.slice(1).map((item) => item.candidate.requestedModel)
		: [];
	const candidates: AutoRouterCandidateDiagnostic[] = [
		...ranked.map((item) => ({
			model: item.candidate.requestedModel,
			resolvedModel: item.candidate.resolvedModel,
			eligible: true,
			reason: item === winner ? "selected" : "lower_score",
			score: round(item.score),
			factors: {
				quality: round(item.factors.quality),
				cost: round(item.factors.cost),
				latency: round(item.factors.latency),
				reliability: round(item.factors.reliability),
			},
			benchmarkIds: item.benchmarkIds,
			providerCount: item.candidate.providers.length,
		})),
		...rejected,
	];
	return {
		ok: true,
		selected: winner.candidate,
		evaluation: {
			algorithm: AUTO_ROUTER_ALGORITHM_VERSION,
			workload: classification.workload,
			objective: args.config.objective,
			selectedModel: winner.candidate.requestedModel,
			selectedResolvedModel: winner.candidate.resolvedModel,
			overriddenByDynamicRoute: null,
			fallbackModels,
			benchmarkSource: "phaseo_catalog",
			benchmarkDataAvailable: benchmarkRows.length > 0,
			benchmarkDataStatus,
			classificationSignals: classification.signals,
			candidates,
		},
	};
}

export async function loadAutoRouterBenchmarks(models: string[], benchmarkIds: string[]): Promise<AutoRouterBenchmarkResult[]> {
	const uniqueModels = [...new Set(models)].slice(0, MAX_ALLOWED_MODELS * 2);
	const permittedBenchmarkIds = benchmarkIds.filter((id) => !isProhibitedAutoRouterBenchmark(id));
	if (!uniqueModels.length || !permittedBenchmarkIds.length) return [];
	const { data, error } = await getSupabaseAdmin()
		.from("v2_benchmark_results")
		.select("model_slug,benchmark_id,score_numeric")
		.in("model_slug", uniqueModels)
		.in("benchmark_id", permittedBenchmarkIds)
		.eq("is_self_reported", false);
	if (error) throw new Error(error.message || "Failed to load auto-router benchmarks");
	return (data ?? []) as AutoRouterBenchmarkResult[];
}

function pricePerMillionTokens(card: PriceCard | null): number | null {
	if (!card) return null;
	let input: number | null = null;
	let output: number | null = null;
	for (const rule of card.rules) {
		const price = Number(rule.price_per_unit);
		if (!Number.isFinite(price) || rule.unit_size <= 0) continue;
		const perMillion = price * (1_000_000 / rule.unit_size);
		if (rule.meter === "input_text_tokens" && (input === null || perMillion < input)) input = perMillion;
		if (rule.meter === "output_text_tokens" && (output === null || perMillion < output)) output = perMillion;
	}
	return input !== null && output !== null ? input + output : null;
}

export function buildAutoRouterCandidateEvidence(args: {
	endpoint: Endpoint;
	requestedModel: string;
	resolvedModel: string;
	providers: ProviderCandidate[];
	contextResult: unknown;
}): CandidateLoadResult {
	const providerIds = args.providers.map((provider) => provider.providerId);
	const health = readHealthManyOptimistic(args.endpoint, args.resolvedModel, providerIds);
	const available = args.providers.filter((provider) =>
		health[provider.providerId]?.breaker !== "open" && Boolean(provider.pricingCard?.rules?.length));
	if (!available.length) return { ok: false, reason: "all_providers_unavailable" };
	const observedHealth = available
		.map((provider) => health[provider.providerId])
		.filter((snapshot) => snapshot && (snapshot.rate_60s > 0 || snapshot.last_updated > 0));
	const latencyValues = observedHealth.map((snapshot) => snapshot.lat_ewma_60s).filter((value): value is number => Number.isFinite(value));
	const reliabilityValues = observedHealth.map((snapshot) => 1 - snapshot.err_ewma_60s).filter(Number.isFinite);
	const priceValues = available.map((provider) => pricePerMillionTokens(provider.pricingCard)).filter((value): value is number => value !== null && Number.isFinite(value));
	return {
		ok: true,
		evidence: {
			requestedModel: args.requestedModel,
			resolvedModel: args.resolvedModel,
			providers: available,
			priceUsdPerMillionTokens: priceValues.length ? Math.min(...priceValues) : null,
			latencyMs: latencyValues.length ? Math.min(...latencyValues) : null,
			reliability: reliabilityValues.length ? Math.max(...reliabilityValues) : 0.8,
			contextResult: args.contextResult,
		},
	};
}
