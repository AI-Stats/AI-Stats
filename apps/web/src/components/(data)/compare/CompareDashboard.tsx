"use client";

import { useMemo, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import MainCard from "./MainCard";
import ComparisonDisplay from "./ComparisonDisplay";
import { ExtendedModel } from "@/data/types";
import CompareMiniHeader from "./CompareMiniHeader";
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

const EMPTY_COMPARISON_SECTIONS = [
	["Overview", "Core model details and context windows"],
	["Gateway performance", "Recent latency, throughput, and usage"],
	["Benchmarks", "Shared benchmark results"],
	["Pricing", "Provider pricing and cost comparison"],
	["Availability", "API providers and subscription plans"],
] as const;

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

function EmptyComparisonState() {
	return (
		<div className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
			<div className="border-b border-border/70 px-4 py-4 sm:px-5">
				<h1 className="text-lg font-semibold">Model comparison</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Add up to four models above to compare them side by side.
				</p>
			</div>
			<div className="divide-y divide-border/70">
				{EMPTY_COMPARISON_SECTIONS.map(([title, description]) => (
					<div
						key={title}
						className="flex min-h-16 flex-col justify-center gap-1 px-4 py-3 sm:grid sm:grid-cols-[minmax(10rem,0.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5"
					>
						<h2 className="text-sm font-medium text-foreground">{title}</h2>
						<p className="text-sm text-muted-foreground">{description}</p>
						<span className="text-xs text-muted-foreground">No models selected</span>
					</div>
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
			<CompareFrame models={models}>
				<EmptyComparisonState />
			</CompareFrame>
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
