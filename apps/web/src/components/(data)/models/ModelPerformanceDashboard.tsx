"use client";

import { useRef, useState } from "react";
import ModelPerformanceCards from "./ModelPerformanceCards";
import ModelSuccessChart from "./ModelSuccessChart";
import ModelTokenTrajectoryChart from "./ModelTokenTrajectory";
import { Activity, BarChart3, Filter, Globe2, Loader2 } from "lucide-react";
import type { ModelPerformanceMetrics } from "@/lib/fetchers/models/getModelPerformance";
import type { ModelTokenTrajectory } from "@/lib/fetchers/models/getModelTokenTrajectory";
import type { ModelPerformanceColo } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { fetchOptionalPublicWebApi } from "@/lib/web-api/client";
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildSingleProviderPercentileSeries } from "@/components/(data)/models/modelPerformancePercentiles";

const STREAM_MODE_LABELS = {
	all: "All responses",
	stream: "Streaming",
	non_stream: "Non-streaming",
} as const;

const CONTEXT_BUCKET_LABELS = {
	all: "All contexts",
	lte_4k: "≤ 4K input",
	"4k_16k": "4K–16K input",
	"16k_64k": "16K–64K input",
	gt_64k: "> 64K input",
} as const;
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
	const [selectedColo, setSelectedColo] = useState<string | null>(
		metrics.cloudflareColo ?? null,
	);
	const [selectedPercentile, setSelectedPercentile] = useState<ModelPercentile>(
		metrics.percentile != null && isModelPercentile(metrics.percentile)
			? metrics.percentile
			: DEFAULT_MODEL_PERCENTILE,
	);
	const [streamMode, setStreamMode] = useState<"all" | "stream" | "non_stream">(
		metrics.streamMode ?? "all",
	);
	const [contextBucket, setContextBucket] = useState<
		"all" | "lte_4k" | "4k_16k" | "16k_64k" | "gt_64k"
	>(metrics.contextBucket ?? "all");
	const [regionMetrics, setRegionMetrics] =
		useState<ModelPerformanceMetrics | null>(null);
	const [isLoadingRegion, setIsLoadingRegion] = useState(false);
	const [isLoadingPercentile, setIsLoadingPercentile] = useState(false);
	const requestGeneration = useRef(0);
	const activeMetrics = regionMetrics ?? metrics;

	const fetchSelectedMetrics = async (
		colo: string | null,
		percentile: number,
		nextStreamMode = streamMode,
		nextContextBucket = contextBucket,
	) => {
		const query = new URLSearchParams({ percentile: String(percentile) });
		if (colo) query.set("colo", colo);
		if (nextStreamMode !== "all") query.set("stream", nextStreamMode);
		if (nextContextBucket !== "all") query.set("context", nextContextBucket);
		const payload = await fetchOptionalPublicWebApi<{
			metrics: ModelPerformanceMetrics | null;
		}>(
			`/api/_web/models/${encodeURIComponent(modelId)}/performance?${query.toString()}`,
		);
		return payload?.metrics ?? null;
	};

	const handleSegmentationChange = async (
		nextStreamMode: "all" | "stream" | "non_stream",
		nextContextBucket: "all" | "lte_4k" | "4k_16k" | "16k_64k" | "gt_64k",
	) => {
		const generation = ++requestGeneration.current;
		const previousStreamMode = streamMode;
		const previousContextBucket = contextBucket;
		setStreamMode(nextStreamMode);
		setContextBucket(nextContextBucket);
		setIsLoadingPercentile(false);
		setIsLoadingRegion(true);
		try {
			const nextMetrics = await fetchSelectedMetrics(
				selectedColo,
				selectedPercentile,
				nextStreamMode,
				nextContextBucket,
			);
			if (generation !== requestGeneration.current) return;
			if (!nextMetrics) {
				setStreamMode(previousStreamMode);
				setContextBucket(previousContextBucket);
				return;
			}
			setRegionMetrics(nextMetrics);
		} catch {
			if (generation === requestGeneration.current) {
				setStreamMode(previousStreamMode);
				setContextBucket(previousContextBucket);
			}
		} finally {
			if (generation === requestGeneration.current) setIsLoadingRegion(false);
		}
	};

	const handleColoChange = async (value: string) => {
		const nextColo = value === "all" ? null : value;
		const generation = ++requestGeneration.current;
		const previousColo = selectedColo;
		setSelectedColo(nextColo);
		setIsLoadingPercentile(false);
		setIsLoadingRegion(true);
		try {
			const nextMetrics = await fetchSelectedMetrics(
				nextColo,
				selectedPercentile,
			);
			if (generation !== requestGeneration.current) return;
			if (!nextMetrics) {
				setSelectedColo(previousColo);
				return;
			}
			setRegionMetrics(nextMetrics);
		} catch {
			if (generation === requestGeneration.current)
				setSelectedColo(previousColo);
		} finally {
			if (generation === requestGeneration.current) setIsLoadingRegion(false);
		}
	};

	const handlePercentileChange = async (nextPercentile: ModelPercentile) => {
		if (nextPercentile === selectedPercentile) return;
		const generation = ++requestGeneration.current;
		const previousPercentile = selectedPercentile;
		setIsLoadingRegion(false);
		setIsLoadingPercentile(true);
		try {
			const nextMetrics = await fetchSelectedMetrics(
				selectedColo,
				nextPercentile,
			);
			if (generation !== requestGeneration.current || !nextMetrics) return;
			setRegionMetrics(nextMetrics);
			setSelectedPercentile(nextPercentile);
		} catch {
			if (generation === requestGeneration.current)
				setSelectedPercentile(previousPercentile);
		} finally {
			if (generation === requestGeneration.current)
				setIsLoadingPercentile(false);
		}
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
	const regionLabel = selectedColo
		? formatCloudflareColo(selectedColo)
		: "Select Location";
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
		<section className="space-y-10">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<h2 className="text-xl font-semibold tracking-tight">Performance</h2>
					<p className="text-sm text-muted-foreground">{headerDescription}</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="hidden items-center gap-2 lg:flex">
						<Select
							value={streamMode}
							disabled={isLoadingRegion}
							onValueChange={(value) =>
								void handleSegmentationChange(
									value as "all" | "stream" | "non_stream",
									contextBucket,
								)
							}
						>
							<SelectTrigger
								size="sm"
								className="h-8 w-36 rounded-md border-border bg-background text-xs"
								aria-label="Streaming mode"
							>
								<SelectValue>{STREAM_MODE_LABELS[streamMode]}</SelectValue>
							</SelectTrigger>
							<SelectContent align="end" className="min-w-44">
								<SelectItem value="all">All responses</SelectItem>
								<SelectItem value="stream">Streaming</SelectItem>
								<SelectItem value="non_stream">Non-streaming</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={contextBucket}
							disabled={isLoadingRegion}
							onValueChange={(value) =>
								void handleSegmentationChange(
									streamMode,
									value as "all" | "lte_4k" | "4k_16k" | "16k_64k" | "gt_64k",
								)
							}
						>
							<SelectTrigger
								size="sm"
								className="h-8 w-36 rounded-md border-border bg-background text-xs"
								aria-label="Context length"
							>
								<SelectValue>{CONTEXT_BUCKET_LABELS[contextBucket]}</SelectValue>
							</SelectTrigger>
							<SelectContent align="end" className="min-w-44">
								<SelectItem value="all">All contexts</SelectItem>
								<SelectItem value="lte_4k">≤ 4K input</SelectItem>
								<SelectItem value="4k_16k">4K–16K input</SelectItem>
								<SelectItem value="16k_64k">16K–64K input</SelectItem>
								<SelectItem value="gt_64k">&gt; 64K input</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<Sheet>
						<SheetTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-2 rounded-lg px-3 text-xs lg:hidden"
								aria-label="Performance filters"
							>
								{isLoadingRegion || isLoadingPercentile ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Filter className="size-3.5" />
								)}
								Filters
							</Button>
						</SheetTrigger>
						<SheetContent
							side="bottom"
							className="max-h-[85dvh] rounded-t-xl border-border/70 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
						>
							<SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
								<SheetTitle>Performance filters</SheetTitle>
								<SheetDescription>
									Refine the requests included in these metrics.
								</SheetDescription>
							</SheetHeader>
							<div className="overflow-y-auto px-5 py-4">
								<div className="space-y-5">
									<fieldset className="space-y-2">
										<legend className="text-xs font-medium text-muted-foreground">
											Response mode
										</legend>
										<div className="grid grid-cols-3 gap-2">
											{Object.entries(STREAM_MODE_LABELS).map(([value, label]) => (
												<Button
													key={value}
													type="button"
													size="sm"
													disabled={isLoadingRegion}
													variant={streamMode === value ? "secondary" : "outline"}
													className="rounded-lg px-2 text-xs"
													aria-pressed={streamMode === value}
													onClick={() =>
														void handleSegmentationChange(
															value as "all" | "stream" | "non_stream",
															contextBucket,
														)
													}
												>
													{label}
												</Button>
											))}
										</div>
									</fieldset>
									<fieldset className="space-y-2">
										<legend className="text-xs font-medium text-muted-foreground">
											Context length
										</legend>
										<div className="grid grid-cols-2 gap-2">
											{Object.entries(CONTEXT_BUCKET_LABELS).map(([value, label]) => (
												<Button
													key={value}
													type="button"
													size="sm"
													disabled={isLoadingRegion}
													variant={contextBucket === value ? "secondary" : "outline"}
													className="justify-start rounded-lg px-3 text-xs"
													aria-pressed={contextBucket === value}
													onClick={() =>
														void handleSegmentationChange(
															streamMode,
															value as keyof typeof CONTEXT_BUCKET_LABELS,
														)
													}
												>
													{label}
												</Button>
											))}
										</div>
									</fieldset>
									<div className="space-y-2">
										<p className="text-xs font-medium text-muted-foreground">
											API location
										</p>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled
											className="w-full justify-start rounded-lg text-xs"
										>
											<Globe2 className="size-3.5" />
											All locations
											<span className="ml-auto text-muted-foreground">Coming soon</span>
										</Button>
									</div>
									{showPercentileSelector ? (
										<fieldset className="space-y-2">
											<legend className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
												<BarChart3 className="size-3.5" />
												Percentile
											</legend>
											<div className="grid grid-cols-5 gap-2">
												{[1, 5, 10, 25, 50, 75, 90, 95, 99].map((percentile) => (
													<Button
														key={percentile}
														type="button"
														size="sm"
														variant={selectedPercentile === percentile ? "secondary" : "outline"}
														className="rounded-lg px-2 text-xs tabular-nums"
														aria-pressed={selectedPercentile === percentile}
														onClick={() => {
															if (isModelPercentile(percentile))
																void handlePercentileChange(percentile);
														}}
													>
														P{String(percentile).padStart(2, "0")}
													</Button>
												))}
											</div>
										</fieldset>
									) : null}
								</div>
							</div>
						</SheetContent>
					</Sheet>
					<div className="hidden items-center gap-2 lg:flex">
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex" tabIndex={0}>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												className="h-8 gap-2 rounded-md px-3 text-xs"
												title="Coming Soon"
												disabled
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
											className="min-w-56 rounded-md"
										>
											<div className="px-2 py-1.5 text-xs text-muted-foreground">
												API Execution Location
											</div>
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
															<span className="ml-auto w-6 text-right text-[11px] tabular-nums text-muted-foreground">
																{group.colos.length}
															</span>
														</DropdownMenuSubTrigger>
														<DropdownMenuSubContent className="max-h-80 min-w-80 rounded-md">
															<DropdownMenuRadioGroup
																value={selectedColo ?? ""}
																onValueChange={handleColoChange}
															>
																<DropdownMenuGroup>
																	{group.colos.map((colo) => {
																		const requests =
																			usageByColo.get(colo.code) ?? 0;
																		return (
																			<DropdownMenuRadioItem
																				key={colo.code}
																				value={colo.code}
																				className="gap-3"
																			>
																				<span className="min-w-0 flex-1 truncate">
																					{formatCloudflareColo(colo.code)}
																				</span>
																				<span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
																					{requests.toLocaleString()}
																				</span>
																			</DropdownMenuRadioItem>
																		);
																	})}
																</DropdownMenuGroup>
															</DropdownMenuRadioGroup>
														</DropdownMenuSubContent>
													</DropdownMenuSub>
												))
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								</span>
							</TooltipTrigger>
							<TooltipContent>Coming Soon</TooltipContent>
						</Tooltip>
						{showPercentileSelector ? (
							<ModelPercentileSelect
								value={selectedPercentile}
								onChange={handlePercentileChange}
								isLoading={isLoadingPercentile}
								ariaLabel="Select performance percentile"
							/>
						) : null}
					</div>
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
