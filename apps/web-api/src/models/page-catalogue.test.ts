import { describe, expect, it } from "vitest";
import {
	mergeModelWeeklyMetrics,
	normalizeModelsPagePricing,
} from "@/models/page-catalogue";

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
