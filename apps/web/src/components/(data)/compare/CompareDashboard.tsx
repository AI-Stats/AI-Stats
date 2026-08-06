"use client";

import { useMemo, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import MainCard from "./MainCard";
import ComparisonDisplay from "./ComparisonDisplay";
import { ExtendedModel } from "@/data/types";
import CompareMiniHeader from "./CompareMiniHeader";
import ModelCombobox from "./ModelCombobox";
import { ProviderLogo } from "./ProviderLogo";
import type { CompareGatewayUsageByModel } from "./types";

const decodeModelIdFromUrl = (value: string): string => {
	const trimmed = value?.trim();
	if (!trimmed) return "";
	if (trimmed.includes("/")) return trimmed;
	if (!trimmed.includes("_")) return trimmed;
	const [organisationId, ...rest] = trimmed.split("_");
	if (!organisationId || rest.length === 0) return trimmed;
	return `${organisationId}/${rest.join("_")}`;
};

const encodeModelIdForUrl = (value: string): string => {
	if (!value) return "";
	const [organisationId, ...rest] = value.split("/");
	if (!organisationId || rest.length === 0) return value;
	return `${organisationId}_${rest.join("/")}`;
};

type CompareDashboardProps = {
	models: ExtendedModel[];
	comparisonData: ExtendedModel[];
	usageByModel: CompareGatewayUsageByModel;
};

type ComparisonPreset = {
	title: string;
	description: string;
	models: ExtendedModel[];
};

function releaseTimestamp(model: ExtendedModel): number {
	if (!model.release_date) return 0;
	const timestamp = new Date(model.release_date).getTime();
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function takeDistinctProviders(models: ExtendedModel[], count = 3): ExtendedModel[] {
	const selected: ExtendedModel[] = [];
	const providers = new Set<string>();
	for (const model of models) {
		const providerId = model.provider?.provider_id;
		if (!providerId || providers.has(providerId)) continue;
		providers.add(providerId);
		selected.push(model);
		if (selected.length === count) break;
	}
	return selected;
}

function takeWithFallback(
	preferred: ExtendedModel[],
	fallback: ExtendedModel[]
): ExtendedModel[] {
	return takeDistinctProviders([...preferred, ...fallback]);
}

function buildComparisonPresets(models: ExtendedModel[]): ComparisonPreset[] {
	const newest = [...models].sort(
		(a, b) => releaseTimestamp(b) - releaseTimestamp(a)
	);
	const candidates: ComparisonPreset[] = [
		{
			title: "Latest releases",
			description: "New models from across the catalogue.",
			models: takeDistinctProviders(newest),
		},
		{
			title: "Benchmark coverage",
			description: "Models with the broadest recorded test results.",
			models: takeWithFallback(
				models
					.filter((model) => (model.benchmark_results?.length ?? 0) > 0)
					.sort(
					(a, b) =>
						(b.benchmark_results?.length ?? 0) -
						(a.benchmark_results?.length ?? 0)
					),
				newest.slice(3)
			),
		},
		{
			title: "Long context",
			description: "Compare the largest available context windows.",
			models: takeWithFallback(
				models
					.filter((model) => (model.input_context_length ?? 0) > 0)
					.sort(
					(a, b) =>
						(b.input_context_length ?? 0) - (a.input_context_length ?? 0)
					),
				newest.slice(6)
			),
		},
		{
			title: "Provider coverage",
			description: "Models with the widest pricing coverage.",
			models: takeWithFallback(
				models
					.filter((model) => (model.prices?.length ?? 0) > 0)
					.sort(
					(a, b) => (b.prices?.length ?? 0) - (a.prices?.length ?? 0)
					),
				newest.slice(9)
			),
		},
	];

	return candidates.filter((preset) => preset.models.length >= 2);
}

function CompareFrame({
	models,
	children,
}: {
	models: ExtendedModel[];
	children: ReactNode;
}) {
	return (
		<div className="w-full">
			<CompareMiniHeader models={models} />
			<div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
				{children}
			</div>
		</div>
	);
}

function EmptyComparisonState({
	models,
	onSelect,
}: {
	models: ExtendedModel[];
	onSelect: (ids: string[]) => void;
}) {
	const presets = useMemo(() => buildComparisonPresets(models), [models]);

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
			<div className="max-w-2xl">
				<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
					Compare AI models
				</h1>
				<p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
					Compare pricing, performance, context, benchmarks, and availability side by side.
				</p>
			</div>

			{presets.length > 0 ? (
				<div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{presets.map((preset) => (
						<button
							type="button"
							key={preset.title}
							onClick={() => onSelect(preset.models.map((model) => model.id))}
							className="group flex min-h-40 flex-col rounded-xl border border-border/70 bg-card/40 p-4 text-left transition-colors hover:border-sky-500/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
					>
							<div className="flex -space-x-1.5">
								{preset.models.map((model) => (
									<ProviderLogo
										key={model.id}
										id={model.provider.provider_id}
										alt={model.provider.name}
										size="xxs"
										className="bg-card ring-2 ring-card"
									/>
								))}
							</div>
							<h2 className="mt-3 text-sm font-semibold text-foreground">
								{preset.title}
							</h2>
							<p className="mt-1 text-sm leading-5 text-muted-foreground">
								{preset.description}
							</p>
							<p className="mt-auto truncate border-t border-border/60 pt-3 text-xs text-muted-foreground group-hover:text-foreground">
								{preset.models.map((model) => model.name).join(" · ")}
							</p>
						</button>
					))}
				</div>
			) : null}

			<div className="mt-8 grid gap-3 sm:grid-cols-2">
				{["first", "second"].map((slot) => (
					<ModelCombobox
						key={slot}
						models={models}
						selected={[]}
						setSelected={onSelect}
						labelWhenEmpty="Select a model"
						labelWhenSelected="Select a model"
						showSelectionCount={false}
						className="h-14 w-full justify-center rounded-xl border border-dashed border-border/80 text-sm text-muted-foreground hover:border-sky-500/50 hover:bg-card hover:text-foreground"
					/>
				))}
			</div>
		</div>
	);
}

export default function CompareDashboard({
	models,
	comparisonData,
	usageByModel,
}: CompareDashboardProps) {
	const searchParams = useSearchParams() ?? new URLSearchParams();
	const router = useRouter();
	const selected = searchParams
		.getAll("models")
		.map((value) => decodeModelIdFromUrl(value))
		.filter(Boolean);

	const selectionLookup = useMemo(() => {
		const map = new Map<string, string>();
		models.forEach((model) => {
			if (!model.id) return;
			map.set(model.id, model.id);
		});
		return map;
	}, [models]);

	const resolvedSelectionIds = useMemo(
		() => selected.map((value) => selectionLookup.get(value) ?? value),
		[selected, selectionLookup]
	);
	const uniqueResolvedSelectionIds = useMemo(() => {
		const uniqueIds: string[] = [];
		const seen = new Set<string>();
		for (const id of resolvedSelectionIds) {
			if (!id || seen.has(id)) continue;
			seen.add(id);
			uniqueIds.push(id);
		}
		return uniqueIds;
	}, [resolvedSelectionIds]);

	const modelsById = useMemo(() => {
		const map = new Map<string, ExtendedModel>();
		for (const model of models) {
			if (!model.id) continue;
			map.set(model.id, model);
		}
		return map;
	}, [models]);

	const setSelected = (ids: string[]) => {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("models");
		ids.forEach((id) => params.append("models", encodeModelIdForUrl(id)));
		router.replace(`?${params.toString()}`);
	};

	const selectedModels = uniqueResolvedSelectionIds
		.map((modelId) => modelsById.get(modelId))
		.filter((model): model is ExtendedModel => Boolean(model));
	const comparisonDataById = useMemo(() => {
		const map = new Map<string, ExtendedModel>();
		for (const model of comparisonData) {
			if (!model.id) continue;
			map.set(model.id, model);
		}
		return map;
	}, [comparisonData]);
	const orderedComparisonData = useMemo(() => {
		if (!uniqueResolvedSelectionIds.length) return comparisonData;
		const ordered = uniqueResolvedSelectionIds
			.map((modelId) => comparisonDataById.get(modelId))
			.filter((model): model is ExtendedModel => Boolean(model));
		const orderedIds = new Set(ordered.map((model) => model.id));
		const fallbackRemainder = comparisonData.filter(
			(model) => !orderedIds.has(model.id)
		);
		return [...ordered, ...fallbackRemainder];
	}, [comparisonData, comparisonDataById, uniqueResolvedSelectionIds]);

	const notFound = uniqueResolvedSelectionIds.filter(
		(id) => !selectedModels.some((m) => m.id === id)
	);

	if (selected.length === 0) {
		return (
			<EmptyComparisonState models={models} onSelect={setSelected} />
		);
	}

	if (selected.length > 0 && selectedModels.length === 0) {
		return (
			<CompareFrame models={models}>
				<div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
				<div className="max-w-2xl w-full bg-yellow-50 border border-yellow-200 rounded-lg p-6">
					<h2 className="text-xl font-semibold text-yellow-900 mb-2">
						Models Not Found
					</h2>
					<p className="text-yellow-800 mb-4">
						The following model IDs from the URL could not be found
						in the database:
					</p>
					<ul className="list-disc list-inside text-yellow-700 mb-4">
						{notFound.map((id) => (
							<li key={id} className="font-mono text-sm">
								{id}
							</li>
						))}
					</ul>
					<p className="text-sm text-yellow-700">
						Please use the search below to find valid model IDs.
					</p>
				</div>
				<Separator className="my-8 w-full max-w-4xl" />
				<MainCard
					models={models}
					selected={[]}
					setSelected={setSelected}
				/>
				</div>
			</CompareFrame>
		);
	}

	if (notFound.length > 0 && selectedModels.length > 0) {
		console.warn(
			`[CompareDashboard] ${selectedModels.length} models found, but ${notFound.length} not found:`,
			notFound
		);
	}

	if (selected.length > 0 && comparisonData.length === 0) {
		console.warn("[compare] No comparison data resolved", {
			selection: selected,
			resolvedIds: uniqueResolvedSelectionIds,
		});
		return (
			<CompareFrame models={models}>
				<div className="flex flex-col items-center justify-center min-h-[40vh] text-center text-muted-foreground space-y-2">
				<p>We couldn&apos;t load the comparison data for this query.</p>
				<button
					type="button"
					className="text-sm font-medium underline underline-offset-4"
					onClick={() => setSelected(uniqueResolvedSelectionIds)}
				>
					Refresh selection
				</button>
				</div>
			</CompareFrame>
		);
	}

	return (
		<CompareFrame models={models}>
			<ComparisonDisplay
				selectedModels={orderedComparisonData}
				usageByModel={usageByModel}
			/>
		</CompareFrame>
	);
}
