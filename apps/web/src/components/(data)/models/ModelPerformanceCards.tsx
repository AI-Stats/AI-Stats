"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type {
	ModelPerformancePoint,
	ModelPerformanceSummary,
	ModelProviderDailyPoint,
	ModelPerformanceQualityPoint,
} from "@/lib/fetchers/models/getModelPerformance";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import ModelProviderTrendChart, {
	isUsableMetricValue,
	type MetricKey,
} from "./ModelProviderTrendChart";
import ModelQualityTrendChart from "./ModelQualityTrendChart";

type MetricValueKey =
	| "avgThroughput"
	| "avgOutputSpeed"
	| "avgLatencyMs"
	| "avgGenerationMs"
	| "avgPhaseoOverheadMs"
	| "avgTpotMs"
	| "avgItlMs";

type MetricDefinition = {
	metric: MetricKey;
	valueKey: MetricValueKey;
	label: string;
	description: string;
	formatValue: (value: number) => string;
};

const formatDuration = (value: number) =>
	value >= 1000
		? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} s`
		: `${Math.round(value)} ms`;

const METRICS: MetricDefinition[] = [
	{
		metric: "throughput",
		valueKey: "avgThroughput",
		label: "Effective throughput",
		description: "Output tokens per second across the complete provider request.",
		formatValue: (value) => `${value.toFixed(1)} t/s`,
	},
	{
		metric: "outputSpeed",
		valueKey: "avgOutputSpeed",
		label: "Output speed",
		description: "Output tokens per second after the first token arrives.",
		formatValue: (value) => `${value.toFixed(1)} t/s`,
	},
	{
		metric: "latency",
		valueKey: "avgLatencyMs",
		label: "Time to first token",
		description: "Time from request start until the first generated output arrives.",
		formatValue: formatDuration,
	},
	{
		metric: "generation",
		valueKey: "avgGenerationMs",
		label: "Provider duration",
		description: "Time from provider dispatch until its final response completes.",
		formatValue: formatDuration,
	},
	{
		metric: "overhead",
		valueKey: "avgPhaseoOverheadMs",
		label: "Phaseo overhead",
		description: "Gateway processing time outside the selected provider request.",
		formatValue: formatDuration,
	},
	{
		metric: "tpot",
		valueKey: "avgTpotMs",
		label: "TPOT",
		description: "Average time per output token after the first token.",
		formatValue: (value) => `${value.toFixed(1)} ms`,
	},
	{
		metric: "itl",
		valueKey: "avgItlMs",
		label: "ITL",
		description: "Estimated average interval between generated tokens.",
		formatValue: (value) => `${value.toFixed(1)} ms`,
	},
];

interface ModelPerformanceCardsProps {
	summary: ModelPerformanceSummary;
	prevSummary?: ModelPerformanceSummary | null;
	hourly: ModelPerformancePoint[];
	providerDaily7d: ModelProviderDailyPoint[];
	chartProviderDaily7d?: ModelProviderDailyPoint[];
	qualitySeries?: ModelPerformanceQualityPoint[];
}

function latestRepresentativeValue(
	definition: MetricDefinition,
	data: ModelProviderDailyPoint[],
) {
	const validPoints = data.filter(
		(point) =>
			point.requests > 0 &&
			isUsableMetricValue(definition.metric, point[definition.valueKey]),
	);
	const latestDay = validPoints
		.map((point) => point.day)
		.sort((a, b) => b.localeCompare(a))[0];
	const latestValues = validPoints
		.filter((point) => point.day === latestDay)
		.map((point) => point[definition.valueKey])
		.filter((value): value is number => value != null && Number.isFinite(value));
	if (latestValues.length === 0) return null;
	return latestValues.reduce((total, value) => total + value, 0) / latestValues.length;
}

export default function ModelPerformanceCards({
	summary,
	prevSummary,
	hourly,
	providerDaily7d,
	chartProviderDaily7d,
	qualitySeries = [],
}: ModelPerformanceCardsProps) {
	const [activeDay, setActiveDay] = useState<string | null>(null);
	void prevSummary;
	const hasHourly = hourly.some((point) => point.requests > 0);
	const hasToolCallQuality = qualitySeries.some(
		(point) => point.toolCallSuccessPct != null,
	);
	const hasStructuredOutputQuality = qualitySeries.some(
		(point) => point.structuredOutputSuccessPct != null,
	);
	const hasCacheQuality = qualitySeries.some(
		(point) => point.cacheHitRatePct != null,
	);
	const detailData = chartProviderDaily7d ?? providerDaily7d;
	const providerCount = new Set(providerDaily7d.map((point) => point.provider)).size;
	const detailSeriesLabel = chartProviderDaily7d
		? "All available percentile bands"
		: `All ${providerCount.toLocaleString()} recorded provider${providerCount === 1 ? "" : "s"}`;
	const availableMetrics = METRICS.map((definition) => {
		const summaryValue = summary[definition.valueKey];
		const value = isUsableMetricValue(definition.metric, summaryValue)
			? summaryValue
			: latestRepresentativeValue(definition, detailData);
		return { definition, value };
	}).filter(
		(metric): metric is { definition: MetricDefinition; value: number } =>
			metric.value != null,
	);

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{availableMetrics.map(({ definition, value }) => (
					<Dialog key={definition.metric}>
						<DialogTrigger asChild>
							<button
								type="button"
								className="group flex min-h-32 min-w-0 flex-col justify-between rounded-lg border border-border/70 bg-background p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
							>
								<span className="flex items-start justify-between gap-3">
									<span className="text-sm font-medium text-muted-foreground">
										{definition.label}
									</span>
									<ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
								</span>
								<span>
									<span className="block text-2xl font-semibold tracking-tight tabular-nums text-foreground">
										{definition.formatValue(value)}
									</span>
									<span className="mt-1 block text-xs text-muted-foreground">
										Open detailed trends
									</span>
								</span>
							</button>
						</DialogTrigger>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
							<DialogHeader className="pr-10">
								<DialogTitle className="text-xl">{definition.label}</DialogTitle>
								<DialogDescription>
									{definition.description} {detailSeriesLabel} are shown below.
								</DialogDescription>
							</DialogHeader>
							<div className="rounded-lg border border-border/70 bg-background p-4">
								<ModelProviderTrendChart
									title={definition.label}
									data={detailData}
									metric={definition.metric}
									maxSeries={Number.MAX_SAFE_INTEGER}
									activeDay={activeDay}
									onActiveDayChange={setActiveDay}
								/>
							</div>
						</DialogContent>
					</Dialog>
				))}
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{hasToolCallQuality ? (
					<ModelQualityTrendChart
						title="Tool call success"
						data={qualitySeries}
						metric="toolCallSuccessPct"
					/>
				) : null}
				{hasStructuredOutputQuality ? (
					<ModelQualityTrendChart
						title="Structured output"
						data={qualitySeries}
						metric="structuredOutputSuccessPct"
					/>
				) : null}
				{hasCacheQuality ? (
					<ModelQualityTrendChart
						title="Cache hit rate"
						data={qualitySeries}
						metric="cacheHitRatePct"
					/>
				) : null}
			</div>

			{!hasHourly ? (
				<p className="text-xs text-muted-foreground">
					Low sample volume in the last 24 hours. Details use the available{" "}
					seven-day history.
				</p>
			) : null}
		</div>
	);
}
