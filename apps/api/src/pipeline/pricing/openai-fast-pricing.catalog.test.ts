import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PriceCard } from "./types";

const DATA_ROOT = path.resolve(process.cwd(), "../../packages/data/catalog/src/data");

function loadCard(modelSlug: string): PriceCard {
	const cardPath = path.join(
		DATA_ROOT,
		"pricing/openai",
		modelSlug,
		"text.generate/pricing.json",
	);
	return JSON.parse(fs.readFileSync(cardPath, "utf8")) as PriceCard;
}

function activePriorityRates(modelSlug: string): Record<string, number> {
	return Object.fromEntries(
		loadCard(modelSlug).rules
			.filter((rule) => rule.pricing_plan === "priority" && !rule.effective_to)
			.map((rule) => [rule.meter, rule.price_per_unit]),
	);
}

describe("OpenAI Fast mode catalogue pricing", () => {
	it.each([
		["openai-gpt-5.2", 3.5, 0.35, 28],
		["openai-gpt-5.1", 2.5, 0.25, 20],
		["openai-gpt-5", 2.5, 0.25, 20],
		["openai-gpt-5-mini", 0.45, 0.045, 3.6],
		["openai-gpt-4.1", 3.5, 0.875, 14],
		["openai-gpt-4.1-mini", 0.7, 0.175, 2.8],
		["openai-gpt-4.1-nano", 0.2, 0.05, 0.8],
		["openai-gpt-4o-2024-08-06", 4.25, 2.125, 17],
		["openai-gpt-4o-mini", 0.25, 0.125, 1],
		["openai-o4-mini", 2, 0.5, 8],
		["openai-o3", 3.5, 0.875, 14],
	])(
		"keeps the published Fast rates for %s",
		(modelSlug, input, cachedInput, output) => {
			expect(activePriorityRates(modelSlug)).toMatchObject({
				input_text_tokens: input,
				cached_read_text_tokens: cachedInput,
				output_text_tokens: output,
			});
		},
	);

	it("keeps the published Fast rates without inventing a cached rate for the original GPT-4o snapshot", () => {
		expect(activePriorityRates("openai-gpt-4o-2024-05-13")).toEqual({
			input_text_tokens: 8.75,
			output_text_tokens: 26.25,
		});
	});
});
