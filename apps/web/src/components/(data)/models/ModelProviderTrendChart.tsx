"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip as RechartsTooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { ModelProviderDailyPoint } from "@/lib/fetchers/models/getModelPerformance";
import { ModelMetricInfo } from "./ModelMetricInfo";

export type MetricKey =
	| "throughput"
	| "outputSpeed"
	| "latency"
	| "generation"
	| "overhead"
	| "tpot"
	| "itl";

type ModelProviderTrendChartProps = {
	title: string;
	data: ModelProviderDailyPoint[];
	metric: MetricKey;
	maxSeries?: number;
	detailed?: boolean;
	headerAction?: ReactNode;
	activeDay: string | null;
	onActiveDayChange: (day: string | null) => void;
};

export function getSeriesEmphasis(
	activeSeriesKey: string | null,
	seriesKey: string,
) {
	const isActive = activeSeriesKey === seriesKey;
	return {
		isActive,
		isDimmed: activeSeriesKey != null && !isActive,
	};
}

export function isUsableMetricValue(
	metric: MetricKey,
	value: number | null | undefined,
) {
	if (value == null || !Number.isFinite(value)) return false;
	return metric === "overhead" ? value >= 0 : value > 0;
}

type MetricConfig = {
	label: string;
	description: string;
	valueKey:
		| "avgThroughput"
		| "avgOutputSpeed"
		| "avgLatencyMs"
		| "avgGenerationMs"
		| "avgPhaseoOverheadMs"
		| "avgTpotMs"
		| "avgItlMs";
	formatValue: (value: number | null) => string;
};

const METRICS: Record<MetricKey, MetricConfig> = {
	throughput: {
		label: "Effective throughput",
		description: "Output tokens per second across the full selected-provider request, including time to first token.",
		valueKey: "avgThroughput",
		formatValue: (value) => (value != null ? `${value.toFixed(2)} t/s` : "-"),
	},
	outputSpeed: {
		label: "Output speed",
		description: "Output tokens per second after the first token arrives, excluding time to first token.",
		valueKey: "avgOutputSpeed",
		formatValue: (value) => (value != null ? `${value.toFixed(2)} t/s` : "-"),
	},
	latency: {
		label: "Time to first token",
		description: "Time from the request entering Phaseo until the first content-bearing generated output reaches the gateway.",
		valueKey: "avgLatencyMs",
		formatValue: (value) => (value != null ? `${Math.round(value)} ms` : "-"),
	},
	generation: {
		label: "Provider duration",
		description: "Time from sending the selected provider request until its final response completes.",
		valueKey: "avgGenerationMs",
		formatValue: (value) => (value != null ? `${Math.round(value)} ms` : "-"),
	},
	overhead: {
		label: "Phaseo overhead",
		description: "Gateway end-to-end duration minus the selected provider duration, including routing and response processing.",
		valueKey: "avgPhaseoOverheadMs",
		formatValue: (value) => (value != null ? `${Math.round(value)} ms` : "-"),
	},
	tpot: {
		label: "TPOT",
		description: "Time per output token after the first token. Lower values indicate faster token generation.",
		valueKey: "avgTpotMs",
		formatValue: (value) => (value != null ? `${value.toFixed(2)} ms` : "-"),
	},
	itl: {
		label: "ITL",
		description: "Estimated average interval between generated tokens. It currently uses the request-level TPOT estimate.",
		valueKey: "avgItlMs",
		formatValue: (value) => (value != null ? `${value.toFixed(2)} ms` : "-"),
	},
};

const FALLBACK_PROVIDER_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

function normalizeColor(value: string | null | undefined): string | null {
	if (!value || typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
	return trimmed;
}

function formatDayHeading(day: string): string {
	const date = new Date(`${day}T00:00:00Z`);
	if (!Number.isFinite(date.getTime())) return day;
	return date.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function toSeriesKey(providerId: string): string {
	return providerId.replace(/[^a-zA-Z0-9]+/g, "_");
}

export default function ModelProviderTrendChart({
	title,
	data,
	metric,
	maxSeries = 3,
	detailed = false,
	headerAction,
	activeDay,
	onActiveDayChange,
}: ModelProviderTrendChartProps) {
	const [hoveredSeriesKey, setHoveredSeriesKey] = useState<string | null>(null);
	const [focusedSeriesKey, setFocusedSeriesKey] = useState<string | null>(null);
	const activeSeriesKey = hoveredSeriesKey ?? focusedSeriesKey;
	const metricConfig = METRICS[metric];
	const observedData = data.filter(
		(point) =>
			point.requests > 0 &&
			isUsableMetricValue(metric, point[metricConfig.valueKey]),
	);
	const providers = Array.from(
		observedData
			.reduce((map, point) => {
				const existing = map.get(point.provider) ?? {
					provider: point.provider,
					name: point.providerName || point.provider,
					color: normalizeColor(point.providerColor),
					requests: 0,
				};
				existing.requests += point.requests;
				if (!existing.color) {
					existing.color = normalizeColor(point.providerColor);
				}
				map.set(point.provider, existing);
				return map;
			}, new Map<string, { provider: string; name: string; color: string | null; requests: number }>())
			.values(),
	)
		.sort((a, b) => b.requests - a.requests)
		.slice(0, maxSeries)
		.map((provider, index) => ({
			...provider,
			seriesKey: toSeriesKey(provider.provider),
			color:
				provider.color ??
				FALLBACK_PROVIDER_COLORS[index] ??
				FALLBACK_PROVIDER_COLORS[0],
		}));

	const providerIdSet = new Set(providers.map((provider) => provider.provider));
	const filtered = observedData.filter((point) =>
		providerIdSet.has(point.provider),
	);
	const sortedDays = Array.from(
		new Set(filtered.map((point) => point.day)),
	).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
	const byDay = new Map<string, Record<string, number | null>>();
	for (const day of sortedDays) {
		byDay.set(day, {});
	}
	for (const point of filtered) {
		const row = byDay.get(point.day);
		if (!row) continue;
		const provider = providers.find(
			(providerItem) => providerItem.provider === point.provider,
		);
		if (!provider) continue;
		row[provider.seriesKey] = point[metricConfig.valueKey] ?? null;
	}
	const chartData = sortedDays.map((day, index) => {
		const values = byDay.get(day) ?? {};
		const row: Record<string, string | number | null> = {
			day,
			index,
		};
		for (const provider of providers) {
			row[provider.seriesKey] = values[provider.seriesKey] ?? null;
		}
		return row;
	});
	const latestRow = chartData[chartData.length - 1] ?? null;
	const hoveredRow = activeDay
		? (chartData.find((row) => row.day === activeDay) ?? null)
		: null;
	const activeRow = hoveredRow ?? latestRow;
	const activeHeadingDate =
		activeRow && typeof activeRow.day === "string"
			? formatDayHeading(activeRow.day)
			: "-";
	const activeIndex =
		activeRow && typeof activeRow.index === "number" ? activeRow.index : null;
	const isHovering = activeDay != null;
	const providerRows = useMemo(
		() =>
			providers.map((provider) => {
				const metricValues = filtered
					.filter((point) => point.provider === provider.provider)
					.map((point) => point[metricConfig.valueKey])
					.filter(
						(value): value is number => value != null && Number.isFinite(value),
					);
				const average =
					metricValues.length > 0
						? metricValues.reduce((sum, value) => sum + value, 0) /
							metricValues.length
						: null;
				const minimum =
					metricValues.length > 0 ? Math.min(...metricValues) : null;
				const maximum =
					metricValues.length > 0 ? Math.max(...metricValues) : null;
				const rawHovered = activeRow?.[provider.seriesKey];
				const hoveredValue =
					typeof rawHovered === "number" && Number.isFinite(rawHovered)
						? rawHovered
						: null;
				return {
					...provider,
					average,
					minimum,
					maximum,
					hoveredValue,
				};
			}),
		[providers, filtered, metricConfig.valueKey, activeRow],
	);

	if (providers.length === 0) {
		return (
			<div className="flex h-full flex-col gap-3">
				<div className="flex items-center gap-1.5">
					<p className="text-lg font-medium leading-none text-foreground">{title}</p>
					<ModelMetricInfo label={metricConfig.label} description={metricConfig.description} />
				</div>
				<div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-xs text-muted-foreground">
					This metric was not recorded for recent requests.
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-1.5">
					<p className="text-lg font-medium leading-none text-foreground">{title}</p>
					<ModelMetricInfo label={metricConfig.label} description={metricConfig.description} />
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<span className="whitespace-nowrap text-[11px] text-muted-foreground">
						{activeHeadingDate}
					</span>
					{headerAction}
				</div>
			</div>
			{chartData.length > 1 ? (
				<div className={detailed ? "h-[300px] w-full pt-1" : "h-[148px] w-full pt-1"}>
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={chartData}
						margin={{ top: 8, right: 0, left: 0, bottom: 6 }}
						onMouseMove={(state: any) => {
							const dayFromPointer =
								typeof state?.activeCoordinate?.x === "number" &&
								typeof state?.offset?.left === "number" &&
								typeof state?.offset?.width === "number" &&
								state.offset.width > 0 &&
								chartData.length > 0
									? (() => {
											const relativeX =
												state.activeCoordinate.x - state.offset.left;
											const clampedX = Math.max(
												0,
												Math.min(relativeX, state.offset.width),
											);
											const index =
												chartData.length === 1
													? 0
													: Math.round(
															(clampedX / state.offset.width) *
																(chartData.length - 1),
														);
											return String(chartData[index]?.day ?? "");
										})()
									: null;
							const dayFromLabel =
								typeof state?.activeLabel === "string"
									? state.activeLabel
									: null;
							const dayFromNumericLabel =
								typeof state?.activeLabel === "number" && chartData.length > 0
									? String(
											chartData[
												Math.max(
													0,
													Math.min(
														chartData.length - 1,
														Math.round(state.activeLabel),
													),
												)
											]?.day ?? "",
										)
									: null;
							const dayFromIndex =
								typeof state?.activeTooltipIndex === "number" &&
								state.activeTooltipIndex >= 0 &&
								state.activeTooltipIndex < chartData.length
									? String(chartData[state.activeTooltipIndex]?.day ?? "")
									: null;
							const dayFromPayload =
								typeof state?.activePayload?.[0]?.payload?.day === "string"
									? state.activePayload[0].payload.day
									: null;
							const day =
								dayFromPointer ||
								dayFromLabel ||
								dayFromNumericLabel ||
								dayFromIndex ||
								dayFromPayload ||
								null;
							onActiveDayChange(day);
						}}
						onMouseLeave={() => onActiveDayChange(null)}
					>
						<CartesianGrid vertical={false} stroke="transparent" />
						<XAxis
							dataKey="index"
							type="number"
							domain={[0, Math.max(chartData.length - 1, 0)]}
							allowDataOverflow
							hide
						/>
						<YAxis hide />
						<RechartsTooltip
							cursor={false}
							content={({ active, payload }) => {
								if (!active || !payload?.length) return null;
								const day = payload[0]?.payload?.day;
								return (
									<div className="min-w-44 rounded-md border border-border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
										<p className="mb-2 font-medium">
											{typeof day === "string" ? formatDayHeading(day) : title}
										</p>
										<div className="space-y-1.5">
											{payload
												.filter(
													(entry) =>
														typeof entry.value === "number" &&
														Number.isFinite(entry.value),
												)
												.map((entry) => {
													const provider = providers.find(
														(item) => item.seriesKey === entry.dataKey,
													);
													if (!provider) return null;
													return (
														<div
															key={provider.seriesKey}
															className="flex items-center justify-between gap-4"
														>
															<span className="inline-flex min-w-0 items-center gap-1.5">
																<span
																	className="size-2 shrink-0 rounded-full"
																	style={{ backgroundColor: provider.color }}
																/>
																<span className="truncate text-muted-foreground">
																	{provider.name}
																</span>
															</span>
															<span className="shrink-0 font-medium tabular-nums">
																{metricConfig.formatValue(Number(entry.value))}
															</span>
														</div>
													);
												})}
										</div>
									</div>
								);
							}}
						/>
						{isHovering && activeIndex != null ? (
							<ReferenceLine
								x={activeIndex}
								stroke="var(--muted-foreground)"
								strokeDasharray="3 4"
								strokeWidth={1}
							/>
						) : null}
						{providers.map((provider) => {
							const { isActive, isDimmed } = getSeriesEmphasis(
								activeSeriesKey,
								provider.seriesKey,
							);
							return (
								<Line
									key={provider.seriesKey}
									type="monotone"
									dataKey={provider.seriesKey}
									stroke={provider.color}
									strokeWidth={isActive ? 3.5 : 2}
									strokeOpacity={isDimmed ? 0.18 : 1}
									style={{
										transition: "stroke-opacity 150ms, stroke-width 150ms",
									}}
									strokeLinecap="round"
									strokeLinejoin="round"
									dot={false}
									connectNulls
									isAnimationActive={false}
									onMouseEnter={() => setHoveredSeriesKey(provider.seriesKey)}
									onMouseLeave={() => setHoveredSeriesKey(null)}
								/>
							);
						})}
					</LineChart>
				</ResponsiveContainer>
				</div>
			) : null}
			{detailed ? (
				<div className="overflow-hidden rounded-md border border-border/70">
					<div className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(5rem,0.35fr))] gap-3 border-b border-border/70 bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground">
						<span>Provider</span>
						<span className="text-right">Min</span>
						<span className="text-right">Max</span>
						<span className="text-right">Avg</span>
					</div>
					{providerRows.map((provider) => (
						<div
							key={provider.seriesKey}
							className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(5rem,0.35fr))] gap-3 border-b border-border/50 px-3 py-2.5 text-sm last:border-b-0"
						>
							<span className="inline-flex min-w-0 items-center gap-2">
								<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: provider.color }} />
								<span className="truncate font-medium">{provider.name}</span>
							</span>
							<span className="text-right tabular-nums text-muted-foreground">{metricConfig.formatValue(provider.minimum)}</span>
							<span className="text-right tabular-nums text-muted-foreground">{metricConfig.formatValue(provider.maximum)}</span>
							<span className="text-right font-medium tabular-nums">{metricConfig.formatValue(provider.average)}</span>
						</div>
					))}
				</div>
			) : (
			<div
				className={
					chartData.length === 1
						? "flex min-h-[148px] flex-col justify-center space-y-2 rounded-md border border-border/60 bg-muted/15 px-3 py-3"
						: "space-y-1.5 pt-1"
				}
			>
				{chartData.length === 1 ? (
					<p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						Latest percentile snapshot
					</p>
				) : null}
				{providerRows.map((provider) => {
					const { isActive, isDimmed } = getSeriesEmphasis(
						activeSeriesKey,
						provider.seriesKey,
					);
					return (
						<div
							key={provider.seriesKey}
							className="flex items-center justify-between gap-3 rounded-sm text-xs outline-none transition-[opacity,transform] duration-150 focus-visible:ring-1 focus-visible:ring-ring"
							style={{
								opacity: isDimmed ? 0.35 : 1,
								transform: isActive ? "translateX(2px)" : "translateX(0)",
							}}
							tabIndex={0}
							onMouseEnter={() => setHoveredSeriesKey(provider.seriesKey)}
							onMouseLeave={() => setHoveredSeriesKey(null)}
							onFocus={() => setFocusedSeriesKey(provider.seriesKey)}
							onBlur={() => setFocusedSeriesKey(null)}
						>
							<span className="inline-flex min-w-0 items-center gap-2">
								<span
									className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: provider.color }}
								/>
								<span
									className={
										isActive
											? "truncate font-medium text-foreground"
											: "truncate text-foreground"
									}
								>
									{provider.name}
								</span>
							</span>
							<span className="shrink-0 tabular-nums text-foreground">
								{isHovering ? (
									metricConfig.formatValue(provider.hoveredValue)
								) : (
									<>
										{chartData.length > 1 ? (
											<span className="text-muted-foreground">Avg </span>
										) : null}
										{metricConfig.formatValue(provider.average)}
									</>
								)}
							</span>
						</div>
					);
				})}
			</div>
			)}
		</div>
	);
}
