"use client";

import { useRef, useState } from "react";
import ModelPerformanceCards from "./ModelPerformanceCards";
import ModelSuccessChart from "./ModelSuccessChart";
import ModelTokenTrajectoryChart from "./ModelTokenTrajectory";
import { Activity, Globe2, Loader2 } from "lucide-react";
import type { ModelPerformanceMetrics } from "@/lib/fetchers/models/getModelPerformance";
import type { ModelTokenTrajectory } from "@/lib/fetchers/models/getModelTokenTrajectory";
import type { ModelPerformanceColo } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import {
	CLOUDFLARE_COLOS,
	CLOUDFLARE_CONTINENTS,
	formatCloudflareColo,
} from "@/lib/cloudflare/colos";
import ModelPercentileSelect, {
	DEFAULT_MODEL_PERCENTILE,
	isModelPercentile,
	type ModelPercentile,
} from "./ModelPercentileSelect";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildSingleProviderPercentileSeries } from "@/components/(data)/models/modelPerformancePercentiles";
import {
	MODEL_PERFORMANCE_REFRESH_INTERVAL_MS,
	useModelPerformanceMetrics,
} from "./useModelPerformanceMetrics";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

interface ModelPerformanceDashboardProps {
	modelId: string;
	metrics: ModelPerformanceMetrics;
	tokenTrajectory: ModelTokenTrajectory | null;
	availableColos: ModelPerformanceColo[];
	headerDescription: string;
	mode?: "overview" | "page";
}

function formatReleaseDate(date: string | null | undefined): string | null {
	if (!date) return null;
	const parsed = new Date(date);
	if (!Number.isFinite(parsed.getTime())) return null;
	return parsed.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export default function ModelPerformanceDashboard({
	modelId,
	metrics,
	tokenTrajectory,
	availableColos,
	headerDescription,
	mode = "overview",
}: ModelPerformanceDashboardProps) {
	const [initialSelection] = useState<{
		colo: string | null;
		percentile: ModelPercentile;
	}>(() => ({
			colo: metrics.cloudflareColo ?? null,
			percentile:
				metrics.percentile != null && isModelPercentile(metrics.percentile)
					? metrics.percentile
					: DEFAULT_MODEL_PERCENTILE,
		}));
	const [selectedColo, setSelectedColo] = useState<string | null>(
		() => initialSelection.colo,
	);
	const [selectedPercentile, setSelectedPercentile] = useState<ModelPercentile>(
		() => initialSelection.percentile,
	);
	const successfulSelectionRef = useRef(initialSelection);
	const isInitialSelection =
		selectedColo === initialSelection.colo &&
		selectedPercentile === initialSelection.percentile;
	const {
		data: selectedMetrics,
		isValidating,
	} = useModelPerformanceMetrics({
		modelId,
		cloudflareColo: selectedColo,
		percentile: selectedPercentile,
		fallbackData: isInitialSelection ? metrics : undefined,
		refreshInterval: MODEL_PERFORMANCE_REFRESH_INTERVAL_MS,
		onError: () => {
				setSelectedColo(successfulSelectionRef.current.colo);
				setSelectedPercentile(successfulSelectionRef.current.percentile);
		},
		onSuccess: (nextMetrics) => {
				if (!nextMetrics) return;
				successfulSelectionRef.current = {
					colo: nextMetrics.cloudflareColo ?? null,
					percentile:
						nextMetrics.percentile != null &&
						isModelPercentile(nextMetrics.percentile)
							? nextMetrics.percentile
							: selectedPercentile,
				};
		},
	});
	const activeMetrics = selectedMetrics ?? metrics;
	const isLoadingRegion =
		isValidating && selectedColo !== (activeMetrics.cloudflareColo ?? null);
	const isLoadingPercentile =
		isValidating && selectedPercentile !== activeMetrics.percentile;

	const handleColoChange = (value: string) => {
		const nextColo = value === "all" ? null : value;
		setSelectedColo(nextColo);
	};

	const handlePercentileChange = (nextPercentile: ModelPercentile) => {
		if (nextPercentile === selectedPercentile) return;
		setSelectedPercentile(nextPercentile);
	};

	const hasTelemetry =
		activeMetrics.summary.totalRequests > 0 ||
		activeMetrics.hourly.some((point) => point.requests > 0);
	const showDetailedPanels = mode === "page";
	const cumulativeTokens =
		activeMetrics.cumulativeTokens != null
			? Math.round(activeMetrics.cumulativeTokens).toLocaleString()
			: "N/A";
	const cumulativeSince = formatReleaseDate(activeMetrics.releaseDate);
	const regionLabel = selectedColo?.toUpperCase() ?? "All Locations";
	const usageByColo = new Map(
		availableColos
			.filter((colo) => colo.requests > 0)
			.map((colo) => [colo.colo, colo.requests]),
	);
	const catalogColosByContinent = CLOUDFLARE_CONTINENTS.map((continent) => ({
		continent,
		colos: CLOUDFLARE_COLOS.filter(
			(colo) => colo.continent === continent && usageByColo.has(colo.code),
		),
	})).filter((group) => group.colos.length > 0);
	const providerCount = new Set(
		activeMetrics.providerDaily7d
			.filter((point) => point.requests > 0)
			.map((point) => point.provider),
	).size;
	const showPercentileSelector = providerCount > 1;
	const singleProviderPercentileSeries = buildSingleProviderPercentileSeries(
		providerCount,
		activeMetrics.providerPercentileDaily7d,
	);

	return (
		<section className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<h2 className="text-xl font-semibold tracking-tight">Performance</h2>
					<p className="text-sm text-muted-foreground">{headerDescription}</p>
				</div>
				<div className="ml-auto flex items-center gap-2">
					{showPercentileSelector ? (
						<ModelPercentileSelect
							value={selectedPercentile}
							onChange={handlePercentileChange}
							isLoading={isLoadingPercentile}
							ariaLabel="Select performance percentile"
						/>
					) : null}
					<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												className="h-8 w-auto max-w-[calc(100vw-2rem)] justify-start gap-2 rounded-lg px-3 text-xs"
												aria-busy={isLoadingRegion}
												aria-label="Filter performance by API location"
											>
												{isLoadingRegion ? (
													<Loader2 className="size-3.5 animate-spin" />
												) : (
													<Globe2 className="size-3.5" />
												)}
												{regionLabel}
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="end"
											className="min-w-56 rounded-lg"
										>
											<div className="px-2 py-1.5 text-xs text-muted-foreground">
												API Execution Location
											</div>
											<DropdownMenuSeparator />
											<DropdownMenuRadioGroup
												value={selectedColo ?? "all"}
												onValueChange={handleColoChange}
											>
												<DropdownMenuRadioItem value="all">
													All Locations
												</DropdownMenuRadioItem>
											</DropdownMenuRadioGroup>
											<DropdownMenuSeparator />
											{catalogColosByContinent.length === 0 ? (
												<DropdownMenuItem disabled>
													No location data available
												</DropdownMenuItem>
											) : (
												catalogColosByContinent.map((group) => (
													<DropdownMenuSub key={group.continent}>
												<DropdownMenuSubTrigger>
													<Globe2 className="size-3.5 text-muted-foreground" />
													{group.continent}
												</DropdownMenuSubTrigger>
														<DropdownMenuSubContent className="max-h-80 min-w-80 rounded-lg">
															<DropdownMenuRadioGroup
																value={selectedColo ?? ""}
																onValueChange={handleColoChange}
															>
																<DropdownMenuGroup>
															{group.colos.map((colo) => (
																	<DropdownMenuRadioItem
																		key={colo.code}
																				value={colo.code}
																				className="gap-3"
																			>
																		<span className="min-w-0 flex-1 truncate">
																			{formatCloudflareColo(colo.code)}
																		</span>
																	</DropdownMenuRadioItem>
															))}
																</DropdownMenuGroup>
															</DropdownMenuRadioGroup>
														</DropdownMenuSubContent>
													</DropdownMenuSub>
												))
											)}
										</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			{hasTelemetry ? (
				<>
					<ModelPerformanceCards
						summary={activeMetrics.summary}
						prevSummary={activeMetrics.prevSummary}
						hourly={activeMetrics.hourly}
						providerDaily7d={activeMetrics.providerDaily7d}
						chartProviderDaily7d={singleProviderPercentileSeries ?? undefined}
						qualitySeries={activeMetrics.qualitySeries}
					/>
					{showDetailedPanels ? (
						<>
							<Card className="px-5 py-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="space-y-1">
										<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
											Cumulative Tokens
										</p>
										<p className="text-2xl font-semibold text-foreground">
											{cumulativeTokens}
										</p>
									</div>
									<p className="text-xs text-muted-foreground">
										{cumulativeSince
											? `Since ${cumulativeSince}`
											: "Since model release"}
									</p>
								</div>
							</Card>
							<ModelSuccessChart successSeries={activeMetrics.successSeries} />
							<ModelTokenTrajectoryChart data={tokenTrajectory} />
						</>
					) : null}
				</>
			) : (
				<Empty className="rounded-lg border p-8">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Activity className="size-5" />
						</EmptyMedia>
						<EmptyTitle>No gateway telemetry yet</EmptyTitle>
						<EmptyDescription>
							This model hasn&apos;t processed any gateway traffic in the
							selected window. Live charts will appear as soon as requests
							arrive.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</section>
	);
}
