import { describe, expect, it } from "vitest";
import {
	collapseModelsPageVariants,
	mergeModelWeeklyMetrics,
	normalizeModelsPagePricing,
} from "@/models/page-catalogue";

describe("collapseModelsPageVariants", () => {
	it("shows one base model while retaining free variant availability", () => {
		const rows = collapseModelsPageVariants([
			{
				model_id: "poolside/laguna-s-2.1",
				name: "Laguna S 2.1",
				gateway_status: "not_active",
				gateway_provider_names: ["OpenRouter"],
				gateway_active_provider_names: [],
				gateway_provider_details: [{ id: "openrouter", name: "OpenRouter", status: "external", service_tier: "standard" }],
				gateway_features: [],
				gateway_tiers: ["standard"],
				popularity_tokens_week: 100,
				weekly_usage_metric: "tokens",
				weekly_usage_quantity: 100,
				weekly_usage_unit: "tokens",
				lowest_from_price: 2,
				lowest_from_price_unit: "1M tokens",
			},
			{
				model_id: "poolside/laguna-s-2.1:free",
				name: "Laguna S 2.1 (Free)",
				gateway_status: "active",
				gateway_provider_names: ["Poolside"],
				gateway_active_provider_names: ["Poolside"],
				gateway_provider_details: [{ id: "poolside", name: "Poolside", is_active: true, service_tier: "standard" }],
				gateway_features: [],
				gateway_tiers: ["standard"],
				popularity_tokens_week: 25,
				weekly_usage_metric: "tokens",
				weekly_usage_quantity: 25,
				weekly_usage_unit: "tokens",
				lowest_from_price: 0,
				lowest_from_price_unit: "1M tokens",
			},
		]);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			model_id: "poolside/laguna-s-2.1",
			name: "Laguna S 2.1",
			gateway_status: "active",
			gateway_provider_count: 1,
			gateway_active_provider_count: 1,
			gateway_features: ["free"],
			gateway_tiers: ["free", "standard"],
			popularity_tokens_week: 125,
			weekly_usage_quantity: 125,
			lowest_from_price: 0,
		});
		expect(rows[0].gateway_provider_details).toContainEqual(expect.objectContaining({
			id: "poolside",
			service_tier: "free",
			variant_kind: "free",
		}));
		expect(rows[0].gateway_provider_names).toEqual(["Poolside"]);
		expect(rows[0].gateway_provider_details).not.toContainEqual(expect.objectContaining({
			status: "external",
		}));
	});

	it("prefers a modality usage meter over a request-count fallback", () => {
		const rows = collapseModelsPageVariants([
			{
				model_id: "poolside/laguna-s-2.1",
				name: "Laguna S 2.1",
				weekly_usage_metric: "requests",
				weekly_usage_quantity: 1,
				weekly_usage_unit: "requests",
			},
			{
				model_id: "poolside/laguna-s-2.1:free",
				name: "Laguna S 2.1 (Free)",
				weekly_usage_metric: "tokens",
				weekly_usage_quantity: 694,
				weekly_usage_unit: "tokens",
			},
		]);

		expect(rows[0]).toMatchObject({
			weekly_usage_metric: "tokens",
			weekly_usage_quantity: 694,
			weekly_usage_unit: "tokens",
		});
	});
});

describe("mergeModelWeeklyMetrics", () => {
	it("replaces catalogue placeholders with v2 rollup metrics", () => {
		const rows = mergeModelWeeklyMetrics([
			{
				model_id: "poolside/laguna-s-2.1",
				popularity_tokens_week: null,
				throughput_week: null,
				latency_week: null,
			},
			{ model_id: "catalogue/only", popularity_tokens_week: null },
		], [
			{
				model_slug: "poolside/laguna-s-2.1",
				popularity_tokens_week: 12_345,
				weekly_usage_metric: "tokens",
				weekly_usage_quantity: 12_345,
				weekly_usage_unit: "tokens",
				throughput_week: 8.75,
				latency_week: 245.5,
			},
		]);

		expect(rows[0]).toMatchObject({
			model_id: "poolside/laguna-s-2.1",
			popularity_tokens_week: 12_345,
			weekly_usage_metric: "tokens",
			weekly_usage_quantity: 12_345,
			weekly_usage_unit: "tokens",
			throughput_week: 8.75,
			latency_week: 245.5,
		});
		expect(rows[1]).toEqual({
			model_id: "catalogue/only",
			popularity_tokens_week: null,
		});
	});
});

describe("normalizeModelsPagePricing", () => {
	it("converts V2 meter rows into the existing model-card pricing contract", () => {
		const row = normalizeModelsPagePricing({
			lowest_input_price: 0.3,
			lowest_output_price: 1.5,
			lowest_standard_input_price: 0.3,
			lowest_standard_output_price: 1.5,
			lowest_standard_input_price_label: "Input",
			lowest_standard_input_price_unit: "billing unit",
			lowest_standard_output_price_label: "Output",
			lowest_standard_output_price_unit: "billing unit",
			lowest_from_price: 0.3,
			lowest_from_price_unit: "billing unit",
			pricing_detail_rows: [
				{ label: "input_text_tokens", meter_key: "input_text_tokens", price: 0.3, unit: "token", unit_quantity: 1_000_000, display_unit: "1000000 token", service_tier: "standard" },
				{ label: "output_text_tokens", meter_key: "output_text_tokens", price: 1.5, unit: "token", unit_quantity: 1_000_000, display_unit: "1M tokens", service_tier: "standard" },
				{ label: "input_text_tokens", meter_key: "input_text_tokens", price: 0.3, unit: "token", unit_quantity: 1_000_000, display_unit: "1000000 token", service_tier: "standard" },
			],
		});

		expect(row).toMatchObject({
			lowest_standard_input_price_label: "Input",
			lowest_standard_input_price_unit: "1M tokens",
			lowest_standard_output_price_label: "Output",
			lowest_standard_output_price_unit: "1M tokens",
			lowest_from_price_unit: "1M tokens",
			pricing_detail_rows: [
				{ label: "Input Text Tokens", value: "$0.3 / 1M tokens" },
				{ label: "Output Text Tokens", value: "$1.5 / 1M tokens" },
			],
		});
	});
});
