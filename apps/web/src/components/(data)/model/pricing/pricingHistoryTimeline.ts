import type { ModelPricingHistoryRule } from "@/lib/fetchers/models/getModelPricingHistoryRules";

export type PricingRange = "7d" | "30d" | "90d" | "1y" | "all";

export type PricingHistoryPoint = Record<string, string | number | null> & {
	timestamp: string;
};

const RANGE_DAYS: Record<Exclude<PricingRange, "all">, number> = {
	"7d": 7,
	"30d": 30,
	"90d": 90,
	"1y": 365,
};

function validTimestamp(value: string | null | undefined): number | null {
	if (!value) return null;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function getPricingHistoryTimestamps({
	range,
	rules,
	usageDays,
	nowMs,
	customStartMs,
	customEndMs,
}: {
	range: PricingRange;
	rules: ModelPricingHistoryRule[];
	usageDays: string[];
	nowMs: number;
	customStartMs?: number;
	customEndMs?: number;
}): number[] {
	const ruleBoundaries = rules.flatMap((rule) =>
		[validTimestamp(rule.effectiveFrom), validTimestamp(rule.effectiveTo)].filter(
			(timestamp): timestamp is number => timestamp !== null,
		),
	);
	const usageTimestamps = usageDays
		.map((day) => Date.parse(`${day}T12:00:00.000Z`))
		.filter(Number.isFinite);
	const earliestAvailable = Math.min(...ruleBoundaries, ...usageTimestamps);
	const presetRangeStart = range === "all"
		? Number.isFinite(earliestAvailable)
			? Math.max(earliestAvailable, nowMs - 3_650 * 86_400_000)
			: nowMs - 365 * 86_400_000
		: nowMs - RANGE_DAYS[range] * 86_400_000;
	const rangeStart = customStartMs ?? presetRangeStart;
	const rangeEnd = Math.min(customEndMs ?? nowMs, nowMs);

	const timestamps = new Set<number>([rangeStart, rangeEnd]);
	for (const timestamp of [...ruleBoundaries, ...usageTimestamps]) {
		if (timestamp >= rangeStart && timestamp <= rangeEnd) timestamps.add(timestamp);
	}
	return Array.from(timestamps).sort((a, b) => a - b);
}

function escapeCsv(value: unknown): string {
	return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function pricingHistoryToCsv({
	points,
	series,
}: {
	points: PricingHistoryPoint[];
	series: Array<{ key: string; providerName: string }>;
}): string {
	const rows = [
		["timestamp_utc", ...series.map((item) => item.providerName)],
		...points.map((point) => [
			point.timestamp,
			...series.map((item) => point[item.key] ?? ""),
		]),
	];
	return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}
