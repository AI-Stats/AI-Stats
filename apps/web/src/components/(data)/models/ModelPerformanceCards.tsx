"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
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
};

const METRICS: MetricDefinition[] = [
	{
		metric: "throughput",
		valueKey: "avgThroughput",
		label: "Effective throughput",
		description: "Output tokens per second across the complete provider request.",
	},
	{
		metric: "outputSpeed",
		valueKey: "avgOutputSpeed",
		label: "Output speed",
		description: "Output tokens per second after the first token arrives.",
	},
	{
		metric: "latency",
		valueKey: "avgLatencyMs",
		label: "Time to first token",
		description: "Time from request start until the first generated output arrives.",
	},
	{
		metric: "generation",
		valueKey: "avgGenerationMs",
		label: "Provider duration",
		description: "Time from provider dispatch until its final response completes.",
	},
	{
		metric: "tpot",
		valueKey: "avgTpotMs",
		label: "TPOT",
		description: "Average time per output token after the first token.",
	},
	{
		metric: "itl",
		valueKey: "avgItlMs",
		label: "ITL",
		description: "Mean observed interval between successive content-bearing provider stream frames. Providers may batch tokens.",
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
	const cardData = chartProviderDaily7d
		? chartProviderDaily7d.filter((point) =>
				["percentile-10", "percentile-50", "percentile-90"].includes(
					point.provider,
				),
			)
		: providerDaily7d;
	const providerCount = new Set(
		providerDaily7d
			.filter((point) => point.requests > 0)
			.map((point) => point.provider),
	).size;
	const detailSeriesLabel = chartProviderDaily7d
		? "All available percentile bands"
		: `All ${providerCount.toLocaleString()} recorded provider${providerCount === 1 ? "" : "s"}`;
	const availableMetrics = METRICS.filter(({ metric, valueKey }) =>
		detailData.some(
			(point) =>
				point.requests > 0 && isUsableMetricValue(metric, point[valueKey]),
		),
	);

	return (
		<div className="space-y-4">
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{availableMetrics.map((definition) => (
					<Dialog key={definition.metric}>
						<div className="min-w-0 rounded-lg border border-border/70 bg-background px-4 py-4">
							<ModelProviderTrendChart
								title={definition.label}
								data={cardData}
								metric={definition.metric}
								maxSeries={3}
								activeDay={activeDay}
								onActiveDayChange={setActiveDay}
								headerAction={
									<DialogTrigger asChild>
										<button
											type="button"
											className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
											aria-label={`Expand ${definition.label}`}
										>
											<Maximize2 className="size-3.5" />
										</button>
									</DialogTrigger>
								}
							/>
						</div>
						<DialogContent className="h-[min(90vh,850px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-5xl">
							<DialogHeader className="pr-10">
								<DialogTitle className="text-xl">{definition.label}</DialogTitle>
								<DialogDescription>
									{definition.description} {detailSeriesLabel} are shown below.
								</DialogDescription>
							</DialogHeader>
							<div className="h-full min-h-0 overflow-hidden rounded-lg border border-border/70 bg-background p-4">
								<ModelProviderTrendChart
									title={definition.label}
									data={detailData}
									metric={definition.metric}
									maxSeries={Number.MAX_SAFE_INTEGER}
									detailed
									showHeader={false}
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
					Low sample volume in the last 24 hours. Trends use the available{" "}
					seven-day history.
				</p>
			) : null}
		</div>
	);
}
