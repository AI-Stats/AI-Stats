import type { Env } from "@/env";
import { listFreeRouterRows } from "@/repositories/free-router";

type FreeRouterModel = {
	modelId: string;
	displayApiModelId: string;
	name: string;
	organisationId: string;
	organisationName: string;
	providerCount: number;
	inputModalities: string[];
	outputModalities: string[];
	usage: { requests30d: number; totalCostNanos30d: number; lastRoutedAt: string | null };
};

export type FreeRouterOverview = {
	summary: { eligibleModels: number; eligibleProviders: number; routedRequests30d: number; totalCostNanos30d: number };
	models: FreeRouterModel[];
};

const EMPTY: FreeRouterOverview = {
	summary: { eligibleModels: 0, eligibleProviders: 0, routedRequests30d: 0, totalCostNanos30d: 0 },
	models: [],
};

function strings(value: unknown): string[] {
	const values = Array.isArray(value)
		? value
		: typeof value === "string"
			? value.replace(/^\{|\}$/g, "").split(",")
			: [];
	return [...new Set(values.map((item) => String(item ?? "").trim().replace(/^"|"$/g, "")).filter(Boolean))].sort();
}

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseOverview(value: unknown): FreeRouterOverview | null {
	const root = record(Array.isArray(value) ? value[0] : value);
	const summary = record(root?.summary);
	if (!root || !summary || !Array.isArray(root.models)) return null;
	return {
		summary: {
			eligibleModels: Number(summary.eligibleModels ?? summary.eligible_models ?? 0) || 0,
			eligibleProviders: Number(summary.eligibleProviders ?? summary.eligible_providers ?? 0) || 0,
			routedRequests30d: Number(summary.routedRequests30d ?? summary.routed_requests_30d ?? 0) || 0,
			totalCostNanos30d: Number(summary.totalCostNanos30d ?? summary.total_cost_nanos_30d ?? 0) || 0,
		},
		models: root.models.flatMap((value) => {
			const row = record(value);
			const usage = record(row?.usage);
			const modelId = String(row?.modelId ?? row?.model_id ?? "").trim();
			return !row || !modelId ? [] : [{
				modelId,
				displayApiModelId: String(row.displayApiModelId ?? row.display_api_model_id ?? modelId),
				name: String(row.name ?? modelId),
				organisationId: String(row.organisationId ?? row.organisation_id ?? ""),
				organisationName: String(row.organisationName ?? row.organisation_name ?? row.organisationId ?? "Unknown"),
				providerCount: Number(row.providerCount ?? row.provider_count ?? 0) || 0,
				inputModalities: strings(row.inputModalities ?? row.input_modalities),
				outputModalities: strings(row.outputModalities ?? row.output_modalities),
				usage: {
					requests30d: Number(usage?.requests30d ?? usage?.requests_30d ?? 0) || 0,
					totalCostNanos30d: Number(usage?.totalCostNanos30d ?? usage?.total_cost_nanos_30d ?? 0) || 0,
					lastRoutedAt: typeof (usage?.lastRoutedAt ?? usage?.last_routed_at) === "string" ? String(usage?.lastRoutedAt ?? usage?.last_routed_at) : null,
				},
			}];
		}),
	};
}

async function v2Overview(env: Env): Promise<FreeRouterOverview> {
	const source = await listFreeRouterRows(env);
	if (!source.length) return EMPTY;
	const modelsById = new Map<string, FreeRouterModel & { _providers?: string[]; _apiIds?: string[] }>();
	const providerIds = new Set<string>();
	for (const row of source) {
		const modelId = String(row.model_slug ?? "").trim();
		const providerId = String(row.provider_slug ?? "").trim();
		if (!modelId || !providerId) continue;
		providerIds.add(providerId);
		const current = modelsById.get(modelId) ?? {
			modelId, displayApiModelId: modelId, name: String(row.name ?? modelId),
			organisationId: String(row.lab_slug ?? ""), organisationName: String(row.organisation_name ?? row.lab_slug ?? "Unknown"),
			providerCount: 0, inputModalities: [], outputModalities: [],
			usage: { requests30d: Number(row.requests_30d ?? 0) || 0, totalCostNanos30d: Number(row.total_cost_nanos_30d ?? 0) || 0, lastRoutedAt: typeof row.last_routed_at === "string" ? row.last_routed_at : null },
		};
		const providers = new Set(current._providers ?? []); providers.add(providerId);
		const apiIds = new Set(current._apiIds ?? []); apiIds.add(String(row.provider_model_slug ?? modelId));
		current.providerCount = providers.size;
		current.displayApiModelId = apiIds.size === 1 ? [...apiIds][0] ?? modelId : modelId;
		current.inputModalities = [...new Set([...current.inputModalities, ...strings(row.input_modalities), ...strings(row.model_input_modalities)])].sort();
		current.outputModalities = [...new Set([...current.outputModalities, ...strings(row.output_modalities), ...strings(row.model_output_modalities)])].sort();
		current._providers = [...providers]; current._apiIds = [...apiIds]; modelsById.set(modelId, current);
	}
	const models = [...modelsById.values()].map((model) => {
		const { _providers, _apiIds, ...result } = model;
		return result;
	}).sort((left, right) => right.usage.requests30d - left.usage.requests30d || left.modelId.localeCompare(right.modelId));
	return { summary: {
		eligibleModels: models.length, eligibleProviders: providerIds.size,
		routedRequests30d: models.reduce((sum, model) => sum + model.usage.requests30d, 0),
		totalCostNanos30d: models.reduce((sum, model) => sum + model.usage.totalCostNanos30d, 0),
	}, models };
}

export async function fetchFreeRouterOverview(env: Env): Promise<FreeRouterOverview> {
	return v2Overview(env);
}

export function buildFreeRouterCatalogueRow(overview: FreeRouterOverview): Record<string, unknown> {
	const input = [...new Set(overview.models.flatMap((model) => model.inputModalities))].sort();
	const output = [...new Set(overview.models.flatMap((model) => model.outputModalities))].sort();
	return {
		model_id: "phaseo/free", name: "Free Models Router", organisation_id: "phaseo", organisation_name: "Phaseo", organisation_colour: null,
		primary_date: "2026-05-12", primary_timestamp: Date.parse("2026-05-12T00:00:00.000Z"), primary_group_key: "2026-05",
		gateway_status: overview.summary.eligibleProviders > 0 ? "active" : "inactive", gateway_provider_count: overview.summary.eligibleProviders, gateway_active_provider_count: overview.summary.eligibleProviders,
		gateway_endpoints: ["chat/completions", "responses", "messages"], gateway_input_modalities: input.length ? input : ["text"], gateway_output_modalities: output.length ? output : ["text"],
		gateway_features: ["routing", "free"], gateway_tiers: ["free"], gateway_provider_names: [], gateway_active_provider_names: [], gateway_execution_regions: [], gateway_provider_details: [], gateway_api_model_ids: ["phaseo/free:text.generate:free"], context_lengths: [], supported_parameters: [],
		lowest_input_price: 0, lowest_output_price: 0, lowest_standard_input_price: 0, lowest_standard_output_price: 0, lowest_standard_input_price_label: "Input", lowest_standard_input_price_unit: "1M tokens", lowest_standard_output_price_label: "Output", lowest_standard_output_price_unit: "1M tokens", lowest_from_price: 0, lowest_from_price_unit: "1M tokens", pricing_detail_rows: [{ label: "Input", value: "$0 / 1M tokens" }, { label: "Output", value: "$0 / 1M tokens" }],
		popularity_tokens_week: null, throughput_week: null, latency_week: null, router_requests_30d: overview.summary.routedRequests30d, router_spend_nanos_30d: overview.summary.totalCostNanos30d,
	};
}
