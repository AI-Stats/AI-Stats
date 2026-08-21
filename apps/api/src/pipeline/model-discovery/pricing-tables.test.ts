import { describe, expect, it } from "vitest";
import {
	diffPricingTableContent,
	extractMdxPricingText,
	extractPriceContentText,
	extractPricingTableText,
	pricingContentLines,
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
});

describe("diffPricingTableContent", () => {
	it("reports added and removed price lines", () => {
		const previous = ["Command A input $2.50 / 1M tokens", "Command A output $10 / 1M tokens"];
		const current = ["Command A input $2.00 / 1M tokens", "Command A output $10 / 1M tokens"];

		expect(diffPricingTableContent(previous, current)).toEqual({
			added: ["Command A input $2.00 / 1M tokens"],
			removed: ["Command A input $2.50 / 1M tokens"],
		});
	});

	it("treats a missing baseline as no diff", () => {
		expect(diffPricingTableContent(null, ["$1 / M tokens"])).toEqual({ added: [], removed: [] });
	});
});

describe("pricingContentLines", () => {
	it("splits normalized content into capped trimmed lines", () => {
		const lines = pricingContentLines("  $2 / M tokens  \n\n$3 / M output tokens");
		expect(lines).toEqual(["$2 / M tokens", "$3 / M output tokens"]);
	});

	it("caps line count and length", () => {
		const many = Array.from({ length: 200 }, (_, index) => `$${index} / M`).join("\n");
		expect(pricingContentLines(many)).toHaveLength(120);
		const longLine = "$1 / M tokens".repeat(30);
		const truncated = pricingContentLines(longLine);
		expect(truncated).toHaveLength(1);
		expect(truncated[0]).toHaveLength(240);
		expect(truncated[0]!.endsWith("…")).toBe(true);
	});
});
