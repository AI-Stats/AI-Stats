import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildVideoPricingRequestOptions } from "@core/video-request-options";
import { computeBill } from "./engine";
import type { PriceCard, PriceRule } from "./types";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function loadCard(relativePath: string): PriceCard {
	const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
	return {
		provider: raw.api_provider_id,
		model: raw.api_model_id,
		endpoint: raw.capability_id,
		effective_from: null,
		effective_to: null,
		currency: "USD",
		version: null,
		rules: raw.rules.map((rule: Record<string, unknown>, index: number): PriceRule => ({
			id: `${String(rule.meter)}:${index}`,
			pricing_plan: String(rule.pricing_plan),
			meter: rule.meter as PriceRule["meter"],
			unit: String(rule.unit),
			unit_size: Number(rule.unit_size),
			price_per_unit: String(rule.price_per_unit),
			currency: String(rule.currency),
			match: Array.isArray(rule.match) ? rule.match as PriceRule["match"] : [],
			priority: Number(rule.priority ?? 0),
		})),
	};
}

describe("Alibaba Cloud Wan 3.0 pricing", () => {
	it("bills standard output and reference-video input seconds at the selected resolution", () => {
		const card = loadCard("packages/data/catalog/src/data/pricing/alibaba-cloud/qwen-wan3.0-video/video.generate/pricing.json");
		const priced = computeBill(
			{ output_video_seconds: 10, input_video_seconds: 8 },
			card,
			buildVideoPricingRequestOptions({ resolution: "720P", input_video_seconds: 8 }),
		);

		expect(priced.pricing.total_usd_str).toBe("1.8");
		expect(priced.pricing.lines.map((line) => line.dimension).sort()).toEqual([
			"input_video_seconds",
			"output_video_seconds",
		]);
	});

	it("uses the higher Prime rate for 1080P output", () => {
		const card = loadCard("packages/data/catalog/src/data/pricing/alibaba-cloud/qwen-wan3.0-video-prime/video.generate/pricing.json");
		const priced = computeBill(
			{ output_video_seconds: 5 },
			card,
			buildVideoPricingRequestOptions({ resolution: "1080P" }),
		);

		expect(priced.pricing.total_usd_str).toBe("1.4");
	});
});
