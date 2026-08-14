import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type JsonObject = Record<string, any>;

export type PricingRuleOptions = {
	unit?: string;
	unitSize?: number;
	note?: string | null;
};

type ChangeReport = { changedFiles: string[] };

export function normalized(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

export async function readJson<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function filesNamed(root: string, fileName: string): Promise<string[]> {
	const output: string[] = [];
	async function visit(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) await visit(entryPath);
			else if (entry.name === fileName) output.push(entryPath);
		}
	}
	await visit(root);
	return output.sort();
}

export async function writeJsonIfChanged(
	filePath: string,
	value: unknown,
	report: ChangeReport,
	options: { dataRoot: string; dryRun: boolean },
): Promise<boolean> {
	const next = `${JSON.stringify(value, null, 2)}\n`;
	const current = await readFile(filePath, "utf8").catch(() => "");
	if (current === next) return false;
	report.changedFiles.push(path.relative(options.dataRoot, filePath).replaceAll("\\", "/"));
	if (!options.dryRun) {
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, next, "utf8");
	}
	return true;
}

export function pricingRule(meter: string, price: number, currency = "USD", options: PricingRuleOptions = {}): JsonObject {
	return {
		meter,
		unit: options.unit ?? "token",
		unit_size: options.unitSize ?? 1_000_000,
		price_per_unit: price,
		currency,
		pricing_plan: "standard",
		note: options.note ?? null,
		match: [],
		priority: 100,
		region: null,
		cache_duration_seconds: null,
		conditions: [],
		source: null,
	};
}

export function safePricingRules(pricing: JsonObject): boolean {
	if (!Array.isArray(pricing.rules)) return false;
	const meters = pricing.rules.map((rule: JsonObject) => normalized(rule?.meter));
	if (meters.some((meter: string) => !meter) || new Set(meters).size !== meters.length) return false;
	return pricing.rules.every((rule: JsonObject) =>
		rule?.pricing_plan === "standard"
		&& (!Array.isArray(rule.match) || rule.match.length === 0)
		&& (!Array.isArray(rule.conditions) || rule.conditions.length === 0)
		&& !rule.effective_to,
	);
}

export function mergeSimplePricing(
	pricing: JsonObject,
	meters: Record<string, number>,
	ruleOptions: Record<string, PricingRuleOptions> = {},
): { value: JsonObject; changed: boolean } {
	if (!safePricingRules(pricing)) return { value: pricing, changed: false };
	let changed = false;
	const byMeter = new Map((pricing.rules as JsonObject[]).map((rule) => [rule.meter, rule]));
	for (const [meter, price] of Object.entries(meters)) {
		const current = byMeter.get(meter);
		if (!current) {
			(pricing.rules as JsonObject[]).push(pricingRule(meter, price, "USD", ruleOptions[meter]));
			changed = true;
		} else if (Number(current.price_per_unit) !== price) {
			current.price_per_unit = price;
			changed = true;
		}
	}
	(pricing.rules as JsonObject[]).sort((left, right) => String(left.meter).localeCompare(String(right.meter)));
	return { value: pricing, changed };
}
