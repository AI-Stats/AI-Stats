import Link from "next/link";
import { Activity, ArrowUpRight, Gauge, Timer } from "lucide-react";

import type { OrganisationModelCards } from "@/lib/fetchers/organisations/types";

type Metric = {
	icon: typeof Gauge;
	label: string;
	format: (value: number) => string;
	key: "throughput_week" | "latency_week" | "popularity_tokens_week";
};

const metrics: Metric[] = [
	{
		icon: Gauge,
		key: "throughput_week",
		label: "Throughput",
		format: (value) => `${value.toFixed(1)} t/s`,
	},
	{
		icon: Timer,
		key: "latency_week",
		label: "Time to first token",
		format: (value) => `${Math.round(value).toLocaleString()} ms`,
	},
	{
		icon: Activity,
		key: "popularity_tokens_week",
		label: "Weekly usage",
		format: (value) =>
			new Intl.NumberFormat("en", {
				compactDisplay: "short",
				notation: "compact",
				maximumFractionDigits: 1,
			}).format(value),
	},
];

export default function LabPerformance({
	models,
}: {
	models: OrganisationModelCards[];
}) {
	const panels = metrics.map((metric) => ({
		...metric,
		models: models
			.map((model) => ({ model, value: model[metric.key] }))
			.filter(
				(entry): entry is { model: OrganisationModelCards; value: number } =>
					typeof entry.value === "number" && Number.isFinite(entry.value),
			)
			.sort((a, b) =>
				metric.key === "latency_week" ? a.value - b.value : b.value - a.value,
			)
			.slice(0, 3),
	}));
	const hasTelemetry = panels.some((panel) => panel.models.length > 0);

	return (
		<div className="overflow-hidden rounded-lg border border-border/70 bg-background">
			<div className="grid md:grid-cols-3 md:divide-x md:divide-border/70">
				{panels.map((panel) => {
					const Icon = panel.icon;
					return (
						<div
							key={panel.key}
							className="min-w-0 border-b border-border/70 p-4 last:border-b-0 md:border-b-0 md:p-5"
						>
							<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
								<Icon className="size-3.5" />
								{panel.label}
							</div>
							<p className="mt-2 text-2xl font-semibold tracking-tight">
								{panel.models[0] ? panel.format(panel.models[0].value) : "—"}
							</p>
							<div className="mt-4 space-y-1">
								{panel.models.map(({ model, value }) => (
									<Link
										key={model.model_id}
										href={`/models/${model.model_id}`}
										className="group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/60"
									>
										<span className="truncate font-medium">{model.name}</span>
										<span className="flex shrink-0 items-center gap-1 text-muted-foreground">
											{panel.format(value)}
											<ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
										</span>
									</Link>
								))}
								{panel.models.length === 0 ? (
									<p className="px-2 py-1.5 text-xs text-muted-foreground">
										No recent data
									</p>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
			{!hasTelemetry ? (
				<p className="border-t border-border/70 px-5 py-3 text-sm text-muted-foreground">
					Performance metrics will appear after this lab&apos;s models serve gateway traffic.
				</p>
			) : null}
		</div>
	);
}
