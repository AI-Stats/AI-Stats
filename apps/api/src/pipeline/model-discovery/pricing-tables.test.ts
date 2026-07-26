import { describe, expect, it } from "vitest";
import {
	extractMdxPricingText,
	extractPriceContentText,
	extractPricingTableText,
	modelsDevPricingSnapshots,
} from "./pricing-tables";

describe("extractPricingTableText", () => {
	it("keeps price-bearing tables and ignores unrelated tables", () => {
		const result = extractPricingTableText(`
			<table><tr><th>Model</th><th>Context</th></tr><tr><td>Example</td><td>128K</td></tr></table>
			<table><tr><th>Model</th><th>Price</th></tr><tr><td>Example</td><td>$1 / M</td></tr></table>
		`);

		expect(result).toEqual({
			tableCount: 1,
			text: "Model Price Example $1 / M",
		});
	});

	it("keeps non-USD pricing tables", () => {
		const result = extractPricingTableText(`
			<table><tr><th>Model</th><th>Price</th></tr><tr><td>Example</td><td>¥3 / M tokens</td></tr></table>
		`);

		expect(result).toEqual({
			tableCount: 1,
			text: "Model Price Example ¥3 / M tokens",
		});
	});

	it("does not double-unescape nested HTML entities", () => {
		const result = extractPricingTableText(`
			<table><tr><th>Price</th></tr><tr><td>&amp;lt; $1 / M</td></tr></table>
		`);

		expect(result.text).toContain("&lt; $1 / M");
		expect(result.text).not.toContain("< $1 / M");
	});

	it("extracts price-bearing content cards without hashing page scripts", () => {
		const result = extractPriceContentText(`
			<script>window.dynamic = Date.now()</script>
			<section><h2>Command A pricing</h2><p>Input $2.50 / 1M tokens</p><p>Output $10 / 1M tokens</p></section>
		`);

		expect(result.tableCount).toBe(1);
		expect(result.text).toContain("Command A pricing");
		expect(result.text).toContain("$2.50 / 1M tokens");
		expect(result.text).not.toContain("Date.now");
	});

	it("extracts pricing rows from MDX documentation", () => {
		const result = extractMdxPricingText(`
			<DocTable
				columns={[{ title: "Input Price" }]}
				rows={[["example", <> {"$"}0.16</>]]}
			/>
		`);

		expect(result).toEqual({
			tableCount: 1,
			text: 'columns={[{ title: "Input Price" }]} rows={[["example", $0.16]]}',
		});
	});

	it("creates stable provider pricing fingerprints from models.dev", async () => {
		const catalog = {
			xai: {
				id: "xai",
				name: "xAI",
				models: {
					grok: { id: "grok", cost: { input: 2, output: 10 } },
					image: { id: "image", cost: { input: 0.1 } },
				},
			},
		};
		const [snapshot] = await modelsDevPricingSnapshots(catalog);

		expect(snapshot).toMatchObject({
			providerId: "models-dev:xai",
			catalogProviderId: "spacex-ai",
			providerName: "xAI (models.dev)",
			tableCount: 1,
			pricingSamples: ["grok: input $2/M, output $10/M"],
		});
		expect(snapshot?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
		expect((await modelsDevPricingSnapshots(catalog))[0]?.fingerprint).toBe(snapshot?.fingerprint);
	});
});
