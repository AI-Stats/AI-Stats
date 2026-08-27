"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type {
	EventType,
	ModelEvent,
} from "@/lib/fetchers/updates/types";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

const STACKED_TYPES: EventType[] = [
	"Announced",
	"Released",
	"Deprecated",
	"Retired",
];

const TYPE_COLORS: Record<EventType, string> = {
	Announced: "bg-sky-500",
	Released: "bg-emerald-500",
	Deprecated: "bg-red-500",
	Retired: "bg-zinc-500",
};

function padTwo(value: number) {
	return `${value}`.padStart(2, "0");
}

type ChartEntry = {
	key: string;
	label: string;
	counts: Record<EventType, number>;
	total: number;
	modelList: Record<
		EventType,
		{ models: Array<{ id: string; name: string }>; total: number }
	>;
};

type ModelCalendarChartProps = {
	events: ModelEvent[];
	monthsWindow?: number;
};

export default function ModelCalendarChart({
	events,
	monthsWindow = 12,
}: ModelCalendarChartProps) {
	const now = useMemo(() => new Date(), []);

	const chartData = useMemo<ChartEntry[]>(() => {
		const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
		windowStart.setMonth(windowStart.getMonth() - (monthsWindow - 1));

		const months = Array.from({ length: monthsWindow }, (_, index) => {
			const monthDate = new Date(windowStart);
			monthDate.setMonth(windowStart.getMonth() + index);
			const key = `${monthDate.getFullYear()}-${padTwo(
				monthDate.getMonth() + 1
			)}`;
			return {
				key,
				label: monthDate.toLocaleString("en-US", {
					month: "short",
					year: "numeric",
				}),
				counts: {
					Announced: 0,
					Released: 0,
					Deprecated: 0,
					Retired: 0,
				} satisfies Record<EventType, number>,
				models: {
					Announced: new Map<string, string>(),
					Released: new Map<string, string>(),
					Deprecated: new Map<string, string>(),
					Retired: new Map<string, string>(),
				} satisfies Record<EventType, Map<string, string>>,
			};
		});

		const byKey = new Map(months.map((entry) => [entry.key, entry]));

		for (const event of events) {
			const parsed = new Date(event.date);
			if (Number.isNaN(parsed.getTime())) continue;
			const key = `${parsed.getFullYear()}-${padTwo(
				parsed.getMonth() + 1
			)}`;
			const entry = byKey.get(key);
			if (!entry) continue;
			const type = (event.types[0] ?? "Announced") as EventType;
			entry.counts[type] = (entry.counts[type] ?? 0) + 1;
			const name =
				event.model.name?.trim() ||
				event.model.model_id ||
				"Unknown model";
			entry.models[type].set(event.model.model_id, name);
		}

		return months.map((entry) => ({
			...entry,
			total: STACKED_TYPES.reduce(
				(sum, type) => sum + (entry.counts[type] ?? 0),
				0
			),
			modelList: Object.fromEntries(
				STACKED_TYPES.map((type) => {
					const allModels = Array.from(
						entry.models[type],
						([id, name]) => ({ id, name })
					).sort((a, b) => a.name.localeCompare(b.name));
					return [
						type,
						{
							models: allModels,
							total: allModels.length,
						},
					];
				})
			) as Record<
				EventType,
				{ models: Array<{ id: string; name: string }>; total: number }
			>,
		}));
	}, [events, now, monthsWindow]);

	return (
		<section className="space-y-4 py-6">
			<div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
						Model event cadence
					</h2>
					<span className="text-xs text-zinc-500 dark:text-zinc-400">
						Last 12 months
					</span>
				</div>
					<div className="flex flex-wrap gap-3 pb-3 pt-4">
						{STACKED_TYPES.map((type) => (
							<div
								key={type}
								className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
							>
								<span
								className={cn(
									"h-2 w-2 rounded-full",
									TYPE_COLORS[type]
								)}
								aria-hidden="true"
							/>
							{type}
						</div>
					))}
				</div>
				<div className="space-y-2">
					{chartData.map((entry) => (
						<div
							key={entry.key}
							className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400"
						>
							<span className="w-[70px] font-semibold text-zinc-700 dark:text-zinc-200">
								{entry.label}
							</span>
							<div className="flex-1 overflow-hidden rounded-full bg-white/80 dark:bg-zinc-900/80">
								<div className="flex h-4">
									{STACKED_TYPES.map((type) => {
										const count = entry.counts[type] ?? 0;
										if (count === 0) return null;
										const width =
											entry.total === 0
												? 0
												: (count / entry.total) * 100;
										const modelsInfo =
											entry.modelList[type];
										return (
											<Dialog
												key={`${entry.key}-${type}`}
											>
												<DialogTrigger asChild>
													<button
														type="button"
														className={cn(
															"h-full cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white",
															TYPE_COLORS[type]
														)}
														style={{
															width: `${width}%`,
														}}
														aria-label={`${type}: ${count}`}
													/>
												</DialogTrigger>
												<DialogContent className="max-w-lg rounded-md">
													<DialogHeader>
														<DialogTitle>
															{type} in {entry.label} ({modelsInfo.total})
														</DialogTitle>
													</DialogHeader>
													<ScrollArea className="max-h-[420px] pr-3">
														<div className="divide-y divide-zinc-200 dark:divide-zinc-800">
															{modelsInfo.models.map((model) => (
																<Link
																	key={model.id}
																	href={`/models/${model.id}`}
																	className="block py-2.5 text-sm font-medium hover:underline"
																>
																	{model.name}
																</Link>
															))}
														</div>
													</ScrollArea>
												</DialogContent>
											</Dialog>
										);
									})}
								</div>
							</div>
							<span className="w-8 text-right font-semibold text-zinc-700 dark:text-zinc-200">
								{entry.total}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
