import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function percentile(values: number[], p: number): number {
	const sorted = values.slice().sort((a, b) => a - b);
	return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const runtime = vi.hoisted(() => ({
	rows: null as null | { routes: any[]; skus: any[]; meters: any[] },
	loadActivePriceRows: vi.fn(async () => runtime.rows ?? { routes: [], skus: [], meters: [] }),
}));

vi.mock("@/repositories/pricing", () => ({ loadActivePriceRows: runtime.loadActivePriceRows }));

const { __resetPricingLoaderCachesForTests, loadPriceCard } = await import("@/pipeline/pricing/loader");

function pricingRows() {
	return {
		routes: [{ providerModelId: "openai:gpt-5-nano", modelSlug: "openai/gpt-5-nano", providerModelSlug: "gpt-5-nano" }],
		skus: [{
			skuId: "sku_standard", providerModelId: "openai:gpt-5-nano", operation: "text.generate",
			serviceTierSlug: "standard", currency: "USD", status: "active", metadata: {},
			effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, updatedAt: "2026-01-01T00:00:00.000Z",
		}],
		meters: [
			{ skuMeterId: "meter_input", skuId: "sku_standard", meterKey: "input_text_tokens", unit: "token", unitQuantity: "1", priceNanos: "1000", meterOrder: 10, metadata: {}, updatedAt: "2026-01-01T00:00:00.000Z" },
			{ skuMeterId: "meter_output", skuId: "sku_standard", meterKey: "output_text_tokens", unit: "token", unitQuantity: "1", priceNanos: "2000", meterOrder: 20, metadata: {}, updatedAt: "2026-01-01T00:00:05.000Z" },
		],
	};
}

describe("pricing loader performance", () => {
	beforeEach(() => {
		runtime.rows = pricingRows();
		runtime.loadActivePriceRows.mockClear();
		__resetPricingLoaderCachesForTests();
	});
	afterEach(__resetPricingLoaderCachesForTests);

	it("deduplicates concurrent inflight loads to one Drizzle repository query", async () => {
		const cards = await Promise.all(Array.from({ length: 3 }, () => loadPriceCard("openai", "openai/gpt-5-nano", "text.generate")));
		expect(cards.every(Boolean)).toBe(true);
		expect(runtime.loadActivePriceRows).toHaveBeenCalledTimes(1);
	});

	it("reuses warm L1 cache across repeated loads", async () => {
		const first = await loadPriceCard("openai", "openai/gpt-5-nano", "text.generate");
		expect(await loadPriceCard("openai", "openai/gpt-5-nano", "text.generate")).toBe(first);
		expect(await loadPriceCard("openai", "openai/gpt-5-nano", "text.generate")).toBe(first);
		expect(runtime.loadActivePriceRows).toHaveBeenCalledTimes(1);
	});

	it("reuses negative cache across repeated misses", async () => {
		runtime.rows = { routes: [], skus: [], meters: [] };
		for (let index = 0; index < 3; index += 1) expect(await loadPriceCard("openai", "openai/missing-model", "text.generate")).toBeNull();
		expect(runtime.loadActivePriceRows).toHaveBeenCalledTimes(1);
	});

	it("keeps warm-cache price-card loads under 2ms p95", async () => {
		await loadPriceCard("openai", "openai/gpt-5-nano", "text.generate");
		const samples: number[] = [];
		for (let index = 0; index < 300; index += 1) {
			const started = performance.now();
			await loadPriceCard("openai", "openai/gpt-5-nano", "text.generate");
			samples.push(performance.now() - started);
		}
		expect(percentile(samples, 95)).toBeLessThan(2);
		expect(runtime.loadActivePriceRows).toHaveBeenCalledTimes(1);
	});
});
