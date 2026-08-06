"use client";

import { useState, type ReactNode } from "react";
import type {
	ModelPerformancePoint,
	ModelPerformanceSummary,
	ModelProviderDailyPoint,
	ModelPerformanceQualityPoint,
} from "@/lib/fetchers/models/getModelPerformance";
import ModelProviderTrendChart, {
	isUsableMetricValue,
	type MetricKey,
} from "./ModelProviderTrendChart";
import ModelQualityTrendChart from "./ModelQualityTrendChart";

function MetricCard({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<div className="min-w-0 rounded-lg border border-border/70 bg-background px-4 py-4">
			<div className="min-h-[228px] w-full min-w-0">{children}</div>
		</div>
	);
}

interface ModelPerformanceCardsProps {
	summary: ModelPerformanceSummary;
	prevSummary?: ModelPerformanceSummary | null;
	hourly: ModelPerformancePoint[];
	providerDaily7d: ModelProviderDailyPoint[];
	chartProviderDaily7d?: ModelProviderDailyPoint[];
	qualitySeries?: ModelPerformanceQualityPoint[];
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
	void summary;
	void prevSummary;
	const hasHourly = hourly.some((point) => point.requests > 0);
	const hasToolCallQuality = qualitySeries.some((point) => point.toolCallSuccessPct != null);
	const hasStructuredOutputQuality = qualitySeries.some((point) => point.structuredOutputSuccessPct != null);
	const hasCacheQuality = qualitySeries.some((point) => point.cacheHitRatePct != null);
	const chartData = chartProviderDaily7d
		? chartProviderDaily7d.filter((point) =>
			["percentile-10", "percentile-50", "percentile-90"].includes(
				point.provider,
			),
		)
		: providerDaily7d;
	const maxSeries = 3;
	const metricAvailability: Array<{
		metric: MetricKey;
		valueKey:
			| "avgThroughput"
			| "avgOutputSpeed"
			| "avgLatencyMs"
			| "avgGenerationMs"
			| "avgPhaseoOverheadMs"
			| "avgTpotMs"
			| "avgItlMs";
		label: string;
	}> = [
		{ metric: "throughput", valueKey: "avgThroughput", label: "Effective throughput" },
		{ metric: "outputSpeed", valueKey: "avgOutputSpeed", label: "Output speed" },
		{ metric: "latency", valueKey: "avgLatencyMs", label: "Time to first token" },
		{ metric: "generation", valueKey: "avgGenerationMs", label: "Provider duration" },
		{ metric: "overhead", valueKey: "avgPhaseoOverheadMs", label: "Phaseo overhead" },
		{ metric: "tpot", valueKey: "avgTpotMs", label: "TPOT" },
		{ metric: "itl", valueKey: "avgItlMs", label: "ITL" },
	];
	const availableMetrics = new Set(
		metricAvailability
			.filter(({ metric, valueKey }) =>
				chartData.some(
					(point) =>
						point.requests > 0 &&
						isUsableMetricValue(metric, point[valueKey]),
				),
			)
			.map(({ metric }) => metric),
	);
	const unavailableMetricLabels = metricAvailability
		.filter(({ metric }) => !availableMetrics.has(metric))
		.map(({ label }) => label);

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{availableMetrics.has("throughput") ? <MetricCard>
				<ModelProviderTrendChart
					title="Effective throughput"
					data={chartData}
					metric="throughput"
					maxSeries={maxSeries}
					activeDay={activeDay}
					onActiveDayChange={setActiveDay}
				/>
			</MetricCard> : null}
			{availableMetrics.has("outputSpeed") ? <MetricCard>
				<ModelProviderTrendChart
					title="Output speed"
					data={chartData}
					metric="outputSpeed"
					maxSeries={maxSeries}
					activeDay={activeDay}
					onActiveDayChange={setActiveDay}
				/>
			</MetricCard> : null}

			{hasToolCallQuality ? (
				<ModelQualityTrendChart title="Tool call success" data={qualitySeries} metric="toolCallSuccessPct" />
			) : null}
			{hasStructuredOutputQuality ? (
				<ModelQualityTrendChart title="Structured output" data={qualitySeries} metric="structuredOutputSuccessPct" />
			) : null}
			{hasCacheQuality ? (
				<ModelQualityTrendChart title="Cache hit rate" data={qualitySeries} metric="cacheHitRatePct" />
			) : null}

			{availableMetrics.has("latency") ? <MetricCard>
				<ModelProviderTrendChart
					title="Time to first token"
					data={chartData}
					metric="latency"
					maxSeries={maxSeries}
					activeDay={activeDay}
					onActiveDayChange={setActiveDay}
				/>
			</MetricCard> : null}

			{availableMetrics.has("generation") ? <MetricCard>
				<ModelProviderTrendChart
					title="Provider duration"
					data={chartData}
					metric="generation"
					maxSeries={maxSeries}
					activeDay={activeDay}
					onActiveDayChange={setActiveDay}
				/>
			</MetricCard> : null}
			{availableMetrics.has("overhead") ? <MetricCard>
				<ModelProviderTrendChart
					title="Phaseo overhead"
					data={chartData}
					metric="overhead"
					maxSeries={maxSeries}
					activeDay={activeDay}
					onActiveDayChange={setActiveDay}
				/>
			</MetricCard> : null}
			{availableMetrics.has("tpot") ? <MetricCard>
				<ModelProviderTrendChart
					title="TPOT"
					data={chartData}
					metric="tpot"
					maxSeries={maxSeries}
					activeDay={activeDay}
					onActiveDayChange={setActiveDay}
				/>
			</MetricCard> : null}
			{availableMetrics.has("itl") ? <MetricCard>
				<ModelProviderTrendChart
					title="ITL"
					data={chartData}
					metric="itl"
					maxSeries={maxSeries}
					activeDay={activeDay}
					onActiveDayChange={setActiveDay}
				/>
			</MetricCard> : null}

			{unavailableMetricLabels.length > 0 ? (
				<div className="rounded-lg border border-dashed border-border/70 px-4 py-3 text-xs text-muted-foreground md:col-span-2 lg:col-span-3">
					<span className="font-medium text-foreground">Not recorded for recent requests:</span>{" "}
					{unavailableMetricLabels.join(", ")}.
				</div>
			) : null}

			{!hasHourly ? (
				<p className="text-xs text-muted-foreground md:col-span-2 lg:col-span-3">
					Low sample volume in the last 24 hours. Trend lines reflect {chartProviderDaily7d
						? "available percentile bands over the last 7 days."
						: "up to 3 active providers over the last 7 days."}
				</p>
			) : null}
		</div>
	);
}
