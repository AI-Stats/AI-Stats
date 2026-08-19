import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeBillSummary } from "./engine";
import type { PriceCard } from "./types";

const DATA_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../packages/data/catalog/src/data");

function loadCard(modelSlug: string): PriceCard {
	return JSON.parse(
		fs.readFileSync(path.join(DATA_ROOT, "pricing/openrouter", modelSlug, "text.generate/pricing.json"), "utf8"),
	) as PriceCard;
}

const canonicalCard = loadCard("openai-gpt-5.6-sol");
const proCard = loadCard("openai-gpt-5.6-sol-pro");

describe("OpenRouter GPT-5.6 Sol catalogue billing", () => {
	it.each([
		["canonical slug", canonicalCard, 272_000, "4.360000000", "5.000000000", "30.000000000"],
		["canonical slug", canonicalCard, 272_001, "7.220010000", "10.000000000", "45.000000000"],
		["Pro compatibility slug", proCard, 272_000, "4.360000000", "5.000000000", "30.000000000"],
		["Pro compatibility slug", proCard, 272_001, "7.220010000", "10.000000000", "45.000000000"],
	])(
		"uses only the matching context tier for the %s at %i input tokens",
		(_label, card, inputTokens, total, inputRate, outputRate) => {
			const result = computeBillSummary(
				{
					input_tokens: inputTokens,
					input_text_tokens: inputTokens,
					output_tokens: 100_000,
					output_text_tokens: 100_000,
				},
				card,
				{},
				"standard",
			);

			expect(result.cost_usd_str).toBe(total);
			expect(result.lines.find((line) => line.dimension === "input_text_tokens")?.unit_price_usd).toBe(inputRate);
			expect(result.lines.find((line) => line.dimension === "output_text_tokens")?.unit_price_usd).toBe(outputRate);
		},
	);
});
