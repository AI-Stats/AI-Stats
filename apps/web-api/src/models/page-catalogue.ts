import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";

type Row = Record<string, unknown>;

type OptionCount = { value: string; count: number };

type WeeklyMetricRow = {
	model_slug: string;
	popularity_tokens_week: number | null;
	weekly_usage_metric: string;
	weekly_usage_quantity: number;
	weekly_usage_unit: string;
	throughput_week: number | null;
	latency_week: number | null;
};

export type ModelsPageFacets = {
	statusCounts: { active: number; coming_soon: number; not_active: number };
	endpointOptions: OptionCount[];
	inputModalityOptions: OptionCount[];
	outputModalityOptions: OptionCount[];
	featureOptions: OptionCount[];
	tierOptions: OptionCount[];
	supportedParameterOptions: OptionCount[];
	providerOptions: OptionCount[];
	regionOptions: OptionCount[];
	creatorOptions: OptionCount[];
	yearOptions: OptionCount[];
};

const MODALITY_ORDER = ["text", "image", "video", "audio", "audio_tts", "audio_stt", "audio_music", "file", "moderations", "rerank", "embeddings"];
const FEATURE_ORDER = ["reasoning", "tools", "structured_outputs", "web_search", "free"];
const ORGANISATION_NAMES: Record<string, string> = { ai21: "AI21", ibm: "IBM", lg: "LG", openai: "OpenAI", "spacex-ai": "SpaceXAI", "z-ai": "z.AI" };

function strings(value: unknown): string[] {
	return Array.isArray(value)
		? [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].sort()
		: [];
}

function pricingUnit(row: Row): string | null {
	const displayUnit = String(row.display_unit ?? "").trim();
	const unit = String(row.unit ?? "").trim().toLowerCase();
	const quantity = Number(row.unit_quantity);
	if (
		/^1(?:000000|m)\s*tokens?$/i.test(displayUnit.replace(/,/g, ""))
		|| (unit === "token" && quantity === 1_000_000)
	) {
		return "1M tokens";
	}
	if (displayUnit && displayUnit.toLowerCase() !== "billing unit") {
		return displayUnit;
	}
	if (unit && Number.isFinite(quantity) && quantity > 0) {
		return `${quantity} ${unit}${quantity === 1 ? "" : "s"}`;
	}
	return unit || null;
}

function pricingLabel(value: unknown): string {
	return String(value ?? "")
		.trim()
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

function pricingValue(price: number, unit: string): string {
	const formatted = price.toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 6,
	});
	return `$${formatted} / ${unit}`;
}

function structuredPricingRows(value: unknown): Row[] {
	return Array.isArray(value)
		? value.filter((row): row is Row => Boolean(row && typeof row === "object"))
		: [];
}

function directionPricingUnit(
	rows: Row[],
	direction: "input" | "output",
	price: unknown,
): string | null {
	const expectedPrice = Number(price);
	const candidates = rows.filter((row) => {
		const meter = String(row.meter_key ?? row.label ?? "").trim().toLowerCase();
		const tier = String(row.service_tier ?? "standard").trim().toLowerCase();
		return tier === "standard" && (meter === direction || meter.startsWith(`${direction}_`));
	});
	const matching = Number.isFinite(expectedPrice)
		? candidates.find((row) => Math.abs(Number(row.price) - expectedPrice) < 1e-9)
		: undefined;
	return pricingUnit(matching ?? candidates[0] ?? {});
}

export function normalizeModelsPagePricing(row: Row): Row {
	const rows = structuredPricingRows(row.pricing_detail_rows);
	if (rows.length === 0) return row;
	const detailRows = rows.flatMap((pricingRow) => {
		const existingLabel = String(pricingRow.label ?? "").trim();
		const existingValue = String(pricingRow.value ?? "").trim();
		if (existingLabel && existingValue) return [{ label: existingLabel, value: existingValue }];
		const price = Number(pricingRow.price);
		const unit = pricingUnit(pricingRow);
		if (!Number.isFinite(price) || !unit) return [];
		const tier = String(pricingRow.service_tier ?? "standard").trim().toLowerCase();
		const baseLabel = pricingLabel(pricingRow.label ?? pricingRow.meter_key);
		if (!baseLabel) return [];
		return [{
			label: tier && tier !== "standard" ? `${baseLabel} (${pricingLabel(tier)})` : baseLabel,
			value: pricingValue(price, unit),
		}];
	});
	const uniqueDetailRows = [...new Map(
		detailRows.map((detail) => [`${detail.label}::${detail.value}`, detail] as const),
	).values()].slice(0, 6);
	const inputUnit = directionPricingUnit(rows, "input", row.lowest_standard_input_price ?? row.lowest_input_price);
	const outputUnit = directionPricingUnit(rows, "output", row.lowest_standard_output_price ?? row.lowest_output_price);
	const fromPrice = Number(row.lowest_from_price);
	const fromRow = Number.isFinite(fromPrice)
		? rows.find((pricingRow) => Math.abs(Number(pricingRow.price) - fromPrice) < 1e-9)
		: undefined;
	const fromUnit = pricingUnit(fromRow ?? {});

	return {
		...row,
		lowest_standard_input_price_label: row.lowest_standard_input_price != null ? "Input" : row.lowest_standard_input_price_label,
		lowest_standard_input_price_unit: inputUnit ?? row.lowest_standard_input_price_unit,
		lowest_standard_output_price_label: row.lowest_standard_output_price != null ? "Output" : row.lowest_standard_output_price_label,
		lowest_standard_output_price_unit: outputUnit ?? row.lowest_standard_output_price_unit,
		lowest_from_price_unit: fromUnit ?? row.lowest_from_price_unit,
		pricing_detail_rows: uniqueDetailRows,
	};
}

const VARIANT_ARRAY_FIELDS = [
	"gateway_endpoints",
	"gateway_input_modalities",
	"gateway_output_modalities",
	"gateway_features",
	"gateway_tiers",
	"gateway_execution_regions",
	"gateway_provider_names",
	"gateway_active_provider_names",
	"gateway_api_model_ids",
	"supported_parameters",
] as const;

const VARIANT_PRICE_FIELDS = [
	"lowest_input_price",
	"lowest_output_price",
	"lowest_standard_input_price",
	"lowest_standard_output_price",
	"lowest_from_price",
] as const;

function baseModelId(row: Row): string {
	const explicit = String(row.base_model_id ?? row.base_model_slug ?? "").trim();
	if (explicit) return explicit;
	const modelId = String(row.model_id ?? "").trim();
	return modelId.toLowerCase().endsWith(":free") ? modelId.slice(0, -5) : modelId;
}

function variantKind(row: Row): string {
	const explicit = String(row.variant_kind ?? "").trim().toLowerCase();
	if (explicit) return explicit;
	return String(row.model_id ?? "").trim().toLowerCase().endsWith(":free") ? "free" : "standard";
}

function lowestNumber(left: unknown, right: unknown): number | null {
	const values = [left, right]
		.filter((value) => value !== null && value !== undefined)
		.map(Number)
		.filter(Number.isFinite);
	return values.length > 0 ? Math.min(...values) : null;
}

function sumNumbers(left: unknown, right: unknown): number | null {
	const values = [left, right]
		.filter((value) => value !== null && value !== undefined)
		.map(Number)
		.filter(Number.isFinite);
	return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
}

function bestGatewayStatus(left: unknown, right: unknown): string {
	const rank = new Map([["active", 3], ["coming_soon", 2], ["not_active", 1], ["not_listed", 0]]);
	const statuses = [String(left ?? "not_listed"), String(right ?? "not_listed")];
	return statuses.sort((a, b) => (rank.get(b) ?? -1) - (rank.get(a) ?? -1))[0] ?? "not_listed";
}

function providerDetails(value: unknown): Row[] {
	return Array.isArray(value)
		? value.filter((detail): detail is Row => Boolean(detail && typeof detail === "object"))
		: [];
}

function withoutExternalProviders(row: Row): Row {
	const details = providerDetails(row.gateway_provider_details);
	if (details.length === 0) return row;
	const visibleDetails = details.filter((detail) =>
		String(detail.status ?? "").trim().toLowerCase() !== "external"
	);
	const providerNames = strings(visibleDetails.map((detail) => detail.name));
	const activeProviderNames = strings(
		visibleDetails.filter((detail) => detail.is_active === true).map((detail) => detail.name),
	);
	return {
		...row,
		gateway_provider_details: visibleDetails,
		gateway_provider_names: providerNames,
		gateway_active_provider_names: activeProviderNames,
		gateway_provider_count: providerNames.length,
		gateway_active_provider_count: activeProviderNames.length,
		gateway_status: activeProviderNames.length > 0
			? "active"
			: String(row.gateway_status ?? "") === "coming_soon" ? "coming_soon" : "not_active",
	};
}

function usageMetricPriority(value: unknown): number {
	const metric = String(value ?? "").trim().toLowerCase();
	if (!metric) return -1;
	if (metric.includes("token")) return 5;
	if (metric.includes("second") || metric.includes("image") || metric.includes("character")) return 4;
	if (metric.includes("request")) return 0;
	return 2;
}

export function collapseModelsPageVariants(rows: Row[]): Row[] {
	const models = new Map<string, Row>();
	const ordered = [...rows].sort((left, right) => Number(variantKind(left) !== "standard") - Number(variantKind(right) !== "standard"));
	for (const row of ordered) {
		const modelId = baseModelId(row);
		if (!modelId) continue;
		const kind = variantKind(row);
		const existing = models.get(modelId);
		if (!existing) {
			models.set(modelId, {
				...row,
				model_id: modelId,
				name: kind === "standard"
					? row.name
					: String(row.name ?? modelId).replace(/\s*\(Free\)\s*$/i, ""),
				variant_kind: "standard",
				base_model_id: null,
				gateway_features: strings([
					...strings(row.gateway_features),
					...(kind === "free" ? ["free"] : []),
				]),
				gateway_tiers: strings([
					...strings(row.gateway_tiers),
					...(kind === "free" ? ["free"] : []),
				]),
			});
			continue;
		}

		const merged: Row = {
			...existing,
			gateway_status: bestGatewayStatus(existing.gateway_status, row.gateway_status),
			popularity_tokens_week: sumNumbers(existing.popularity_tokens_week, row.popularity_tokens_week),
			pricing_detail_rows: [...structuredPricingRows(existing.pricing_detail_rows), ...structuredPricingRows(row.pricing_detail_rows)],
		};
		merged.context_lengths = [...new Set([
			...(Array.isArray(existing.context_lengths) ? existing.context_lengths : []),
			...(Array.isArray(row.context_lengths) ? row.context_lengths : []),
		].map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
		merged.gateway_provider_details = [...new Map(
			[
				...providerDetails(existing.gateway_provider_details),
				...providerDetails(row.gateway_provider_details).map((detail) => kind === "free"
					? { ...detail, variant_kind: "free", service_tier: "free" }
					: detail),
			].map((detail) => [
				[
					detail.id,
					detail.provider_model_slug,
					detail.service_tier,
					detail.variant_kind,
				].join("::"),
				detail,
			] as const),
		).values()];
		for (const field of VARIANT_ARRAY_FIELDS) {
			merged[field] = strings([
				...strings(existing[field]),
				...strings(row[field]),
				...(field === "gateway_features" && kind === "free" ? ["free"] : []),
				...(field === "gateway_tiers" && kind === "free" ? ["free"] : []),
			]);
		}
		for (const field of VARIANT_PRICE_FIELDS) {
			const left = existing[field] == null ? Number.NaN : Number(existing[field]);
			const right = row[field] == null ? Number.NaN : Number(row[field]);
			const rightWins = Number.isFinite(right) && (!Number.isFinite(left) || right < left);
			merged[field] = lowestNumber(existing[field], row[field]);
			if (rightWins) {
				if (field === "lowest_standard_input_price") {
					merged.lowest_standard_input_price_label = row.lowest_standard_input_price_label;
					merged.lowest_standard_input_price_unit = row.lowest_standard_input_price_unit;
				}
				if (field === "lowest_standard_output_price") {
					merged.lowest_standard_output_price_label = row.lowest_standard_output_price_label;
					merged.lowest_standard_output_price_unit = row.lowest_standard_output_price_unit;
				}
				if (field === "lowest_from_price") merged.lowest_from_price_unit = row.lowest_from_price_unit;
			}
		}
		if (
			String(existing.weekly_usage_metric ?? "") === String(row.weekly_usage_metric ?? "")
			&& String(existing.weekly_usage_unit ?? "") === String(row.weekly_usage_unit ?? "")
		) {
			merged.weekly_usage_quantity = sumNumbers(existing.weekly_usage_quantity, row.weekly_usage_quantity);
		} else if (usageMetricPriority(row.weekly_usage_metric) > usageMetricPriority(existing.weekly_usage_metric)) {
			merged.weekly_usage_metric = row.weekly_usage_metric;
			merged.weekly_usage_quantity = row.weekly_usage_quantity;
			merged.weekly_usage_unit = row.weekly_usage_unit;
		}
		const providerNames = strings(merged.gateway_provider_names);
		const activeProviderNames = strings(merged.gateway_active_provider_names);
		merged.gateway_provider_count = providerNames.length;
		merged.gateway_active_provider_count = activeProviderNames.length;
		models.set(modelId, merged);
	}
	return [...models.values()].map(withoutExternalProviders);
}

function modality(value: string): string {
	const normalized = value.toLowerCase().replace(/[._/-]+/g, " ");
	if (normalized.includes("embed")) return "embeddings";
	if (normalized.includes("moderat")) return "moderations";
	if (normalized.includes("rerank") || normalized.includes("re rank")) return "rerank";
	if (normalized.includes("image")) return "image";
	if (normalized.includes("video")) return "video";
	if (normalized.includes("music")) return "audio_music";
	if (normalized.includes("transcrib") || normalized.includes("speech to text") || normalized.includes("stt")) return "audio_stt";
	if (normalized.includes("text to speech") || normalized.includes("audio speech") || normalized.includes("speech synth") || normalized.includes("tts")) return "audio_tts";
	if (normalized.includes("audio")) return "audio";
	if (normalized.includes("file")) return "file";
	if (normalized.includes("text")) return "text";
	return normalized.trim();
}

function optionCounts(rows: Row[], field: string, normalize: (value: string) => string = (value) => value): OptionCount[] {
	const counts = new Map<string, number>();
	for (const row of rows) for (const raw of strings(row[field])) {
		const value = normalize(raw);
		if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts].map(([value, count]) => ({ value, count })).sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function ordered(options: OptionCount[], order: string[]): OptionCount[] {
	const positions = new Map(order.map((value, index) => [value, index]));
	return [...options].sort((left, right) => {
		const leftIndex = positions.get(left.value);
		const rightIndex = positions.get(right.value);
		if (leftIndex != null || rightIndex != null) return leftIndex == null ? 1 : rightIndex == null ? -1 : leftIndex - rightIndex;
		return right.count - left.count || left.value.localeCompare(right.value);
	});
}

function creator(row: Row): string {
	const id = String(row.organisation_id ?? "").trim().toLowerCase();
	const name = String(row.organisation_name ?? "").trim();
	const override = ORGANISATION_NAMES[id];
	if (!name) return override ?? "";
	return override && (name.toLowerCase().replace(/\s+/g, "-") === id || name === name.toLowerCase()) ? override : name;
}

export function buildModelsPageFacets(rows: Row[]): ModelsPageFacets {
	const statusCounts = { active: 0, coming_soon: 0, not_active: 0 };
	const creatorCounts = new Map<string, number>();
	const yearCounts = new Map<string, number>();
	for (const row of rows) {
		const status = row.gateway_status === "active" ? "active" : row.gateway_status === "coming_soon" ? "coming_soon" : "not_active";
		statusCounts[status] += 1;
		const creatorName = creator(row);
		if (creatorName) creatorCounts.set(creatorName, (creatorCounts.get(creatorName) ?? 0) + 1);
		const timestamp = Number(row.primary_timestamp);
		const date = Number.isFinite(timestamp) ? new Date(timestamp) : row.primary_date ? new Date(String(row.primary_date)) : null;
		const year = date && Number.isFinite(date.getTime()) ? String(date.getUTCFullYear()) : "";
		if (year) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
	}
	const creatorOptions = [...creatorCounts].map(([value, count]) => ({ value, count })).sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
	const yearOptions = [...yearCounts].map(([value, count]) => ({ value, count })).sort((left, right) => Number(right.value) - Number(left.value));
	return {
		statusCounts,
		endpointOptions: optionCounts(rows, "gateway_endpoints"),
		inputModalityOptions: ordered(optionCounts(rows, "gateway_input_modalities", modality), MODALITY_ORDER),
		outputModalityOptions: ordered(optionCounts(rows, "gateway_output_modalities", modality), MODALITY_ORDER),
		featureOptions: ordered(optionCounts(rows, "gateway_features"), FEATURE_ORDER),
		tierOptions: optionCounts(rows, "gateway_tiers"),
		supportedParameterOptions: optionCounts(rows, "supported_parameters"),
		providerOptions: optionCounts(rows, "gateway_provider_names"),
		regionOptions: optionCounts(rows, "gateway_execution_regions"),
		creatorOptions,
		yearOptions,
	};
}

export type ModelsPageQuery = {
	region?: string | null;
	serviceTier?: string | null;
};

async function databasePageRows(env: Env, query: ModelsPageQuery = {}): Promise<Row[]> {
	const rows: Row[] = [];
	for (let offset = 0; ; offset += 1_000) {
		const result = await getDataClient(env).rpc(
			"get_v2_public_models_page_rows",
			{ p_region: query.region ?? null, p_service_tier: query.serviceTier ?? null },
		).range(offset, offset + 999);
		if (result.error) throw result.error;
		rows.push(...((result.data ?? []) as Row[]));
		if ((result.data?.length ?? 0) < 1_000) break;
	}
	return rows;
}

async function weeklyMetrics(env: Env): Promise<WeeklyMetricRow[]> {
	const rows: WeeklyMetricRow[] = [];
	for (let offset = 0; ; offset += 1_000) {
		const result = await getDataClient(env)
			.rpc("get_v2_public_model_weekly_metrics")
			.range(offset, offset + 999);
		if (result.error) {
			console.error("models_weekly_metrics_failed", {
				code: result.error.code,
				message: result.error.message,
			});
			return [];
		}
		rows.push(...((result.data ?? []) as WeeklyMetricRow[]));
		if ((result.data?.length ?? 0) < 1_000) break;
	}
	return rows;
}

export function mergeModelWeeklyMetrics(rows: Row[], metrics: WeeklyMetricRow[]): Row[] {
	const metricsByModel = new Map(
		metrics.map((metric) => [String(metric.model_slug ?? "").trim(), metric]),
	);
	return rows.map((row) => {
		const metric = metricsByModel.get(String(row.model_id ?? "").trim());
		return metric
			? {
				...row,
				popularity_tokens_week: metric.popularity_tokens_week,
				weekly_usage_metric: metric.weekly_usage_metric,
				weekly_usage_quantity: metric.weekly_usage_quantity,
				weekly_usage_unit: metric.weekly_usage_unit,
				throughput_week: metric.throughput_week,
				latency_week: metric.latency_week,
			}
			: row;
	});
}

export async function fetchModelsPageCatalogue(
	env: Env,
	query: ModelsPageQuery = {},
	_catalogueVersion: "v1" | "v2" = "v2",
): Promise<{ models: Row[]; pricingComplete: boolean }> {
	const [databaseRows, modelWeeklyMetrics] = await Promise.all([
		databasePageRows(env, query),
		weeklyMetrics(env),
	]);
	return {
		models: collapseModelsPageVariants(mergeModelWeeklyMetrics(
			databaseRows.map(normalizeModelsPagePricing),
			modelWeeklyMetrics,
		)),
		pricingComplete: true,
	};
}
