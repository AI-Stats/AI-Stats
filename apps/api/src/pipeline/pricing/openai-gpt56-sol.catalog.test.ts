import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeBillSummary } from "./engine";
import type { PriceCard } from "./types";

const DATA_ROOT = path.resolve(process.cwd(), "../../packages/data/catalog/src/data");

function loadCard(relativePath: string): PriceCard {
	return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, relativePath), "utf8")) as PriceCard;
}

const canonicalCard = loadCard("pricing/openai/openai-gpt-5.6-sol/text.generate/pricing.json");
const proAliasCard = loadCard("pricing/openai/openai-gpt-5.6-sol-pro/text.generate/pricing.json");
const terraCard = loadCard("pricing/openai/openai-gpt-5.6-terra/text.generate/pricing.json");
const terraProAliasCard = loadCard("pricing/openai/openai-gpt-5.6-terra-pro/text.generate/pricing.json");
const lunaCard = loadCard("pricing/openai/openai-gpt-5.6-luna/text.generate/pricing.json");
const lunaProAliasCard = loadCard("pricing/openai/openai-gpt-5.6-luna-pro/text.generate/pricing.json");

describe("GPT-5.6 Sol catalogue billing", () => {
	it.each([
		["canonical slug", canonicalCard],
		["Pro compatibility alias", proAliasCard],
	])("bills reported reasoning tokens once for the %s", (_label, card) => {
		const result = computeBillSummary(
			{
				input_tokens: 100_000,
				input_text_tokens: 100_000,
				output_tokens: 100_000,
				output_text_tokens: 100_000,
				reasoning_tokens: 80_000,
			},
			card,
			{},
			"standard",
		);

		expect(result.cost_usd_str).toBe("3.500000000");
		expect(result.lines.find((line) => line.dimension === "output_text_tokens")?.quantity).toBe(100_000);
		expect(result.lines.find((line) => line.dimension === "output_reasoning_tokens")).toBeUndefined();
	});

	it.each([
		["Sol canonical slug", canonicalCard, "15.000000000", "20.000000000", "90.000000000"],
		["Sol Pro compatibility alias", proAliasCard, "15.000000000", "20.000000000", "90.000000000"],
		["Terra canonical slug", terraCard, "6.000000000", "8.000000000", "36.000000000"],
		["Terra Pro compatibility alias", terraProAliasCard, "6.000000000", "8.000000000", "36.000000000"],
		["Luna canonical slug", lunaCard, "0.600000000", "0.800000000", "3.600000000"],
		["Luna Pro compatibility alias", lunaProAliasCard, "0.600000000", "0.800000000", "3.600000000"],
	])("applies the published high-context Priority rates for the %s", (_label, card, total, inputRate, outputRate) => {
		const result = computeBillSummary(
			{
				input_tokens: 300_000,
				input_text_tokens: 300_000,
				output_tokens: 100_000,
				output_text_tokens: 100_000,
				reasoning_tokens: 80_000,
			},
			card,
			{},
			"priority",
		);

		expect(result.cost_usd_str).toBe(total);
		expect(result.lines.find((line) => line.dimension === "input_text_tokens")?.unit_price_usd).toBe(inputRate);
		expect(result.lines.find((line) => line.dimension === "output_text_tokens")?.unit_price_usd).toBe(outputRate);
	});

	it.each([
		[272_000, "8.720000000", "10.000000000", "60.000000000"],
		[272_001, "14.440020000", "20.000000000", "90.000000000"],
	])(
		"switches Priority pricing only above 272K input tokens (%i)",
		(inputTokens, total, inputRate, outputRate) => {
			const result = computeBillSummary(
				{
					input_tokens: inputTokens,
					input_text_tokens: inputTokens,
					output_tokens: 100_000,
					output_text_tokens: 100_000,
				},
				canonicalCard,
				{},
				"priority",
			);

			expect(result.cost_usd_str).toBe(total);
			expect(result.lines.find((line) => line.dimension === "input_text_tokens")?.unit_price_usd).toBe(inputRate);
			expect(result.lines.find((line) => line.dimension === "output_text_tokens")?.unit_price_usd).toBe(outputRate);
		},
	);
});
