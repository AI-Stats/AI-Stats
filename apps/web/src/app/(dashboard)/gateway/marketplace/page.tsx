import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
	ArrowLeft,
	BadgeCheck,
	Compass,
	Flame,
	GitFork,
	Search,
	Sparkles,
	Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { fetchFrontendMarketplacePresets } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import type { MarketplacePreset } from "@/lib/fetchers/gateway/marketplaceTypes";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Gateway Marketplace",
	description:
		"Browse public Phaseo Gateway presets, copy proven configurations to your workspace, and customize model routing, retries, and policy behavior for your team.",
	path: "/gateway/marketplace",
	keywords: [
		"Phaseo marketplace",
		"gateway presets",
		"AI routing presets",
	],
});

export default async function GatewayMarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
	const [{ q }, presets] = await Promise.all([searchParams, fetchFrontendMarketplacePresets()]);
	const query = q?.trim().toLowerCase() ?? "";
	const matching = query ? presets.filter((preset) => [preset.name, preset.description, preset.publisher.displayName, preset.publisher.handle, preset.canonicalModel].some((value) => String(value ?? "").toLowerCase().includes(query))) : presets;
	const ranked = [...matching].sort((left, right) => right.descendantCount - left.descendantCount || right.forkCount - left.forkCount || Date.parse(right.created_at) - Date.parse(left.created_at));
	const featured = ranked.slice(0, 6);
	const community = ranked.slice(6, 14);
	const popular = ranked.slice(0, 3);

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-950">
			<div className="container mx-auto space-y-8 px-4 py-8">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Compass className="h-4 w-4" />
					<span>Gateway Marketplace</span>
				</div>

				<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<h1 className="text-3xl font-semibold tracking-tight">
								Phaseo Gateway Marketplace
							</h1>
							<Badge variant="outline">Beta</Badge>
						</div>
						<p className="text-sm text-muted-foreground max-w-2xl">
							Browse community and team presets built for the Phaseo Gateway.
							Copy a preset to your account and customize it from there.
						</p>
						<div className="flex flex-wrap items-center gap-3">
							<Button variant="default" className="gap-2" asChild>
								<Link href="/settings/presets">
								<Store className="h-4 w-4" />
								Publish preset
								</Link>
							</Button>
							<Button variant="outline" className="gap-2" asChild>
								<Link href="/settings/presets" target="_blank" rel="noreferrer">
									Manage my presets
								</Link>
							</Button>
						</div>
					</div>

					<form className="relative w-full md:w-72" action="/gateway/marketplace">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input name="q" defaultValue={q} placeholder="Search presets" className="pl-9" />
					</form>
				</div>

				<Card className="border-dashed">
					<CardHeader className="space-y-2">
						<CardTitle className="flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-muted-foreground" />
							Featured presets
						</CardTitle>
						<CardDescription>
								The most-forked public presets from the Phaseo community.
						</CardDescription>
					</CardHeader>
					<CardContent className="relative">
						{featured.length === 0 ? (
							<EmptyState />
						) : (
							<Carousel opts={{ align: "start" }}>
								<CarouselContent>
									{featured.map((preset) => (
										<CarouselItem
											key={preset.id}
											className="md:basis-1/2 lg:basis-1/3"
										>
											<MarketplaceCard preset={preset} tag="Featured" />
										</CarouselItem>
									))}
								</CarouselContent>
								<CarouselPrevious />
								<CarouselNext />
							</Carousel>
						)}
					</CardContent>
				</Card>

				<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<Card>
						<CardHeader className="space-y-2">
							<CardTitle className="flex items-center gap-2">
								<BadgeCheck className="h-4 w-4 text-muted-foreground" />
								Community picks
							</CardTitle>
							<CardDescription>
								Popular public presets with consistent results.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3">
							{community.length === 0 ? (
								<EmptyState />
							) : (
								community.map((preset) => (
									<CompactPresetRow key={preset.id} preset={preset} />
								))
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="space-y-2">
							<CardTitle className="flex items-center gap-2">
								<Flame className="h-4 w-4 text-muted-foreground" />
								Most forked
							</CardTitle>
							<CardDescription>
								Popular presets ranked by the number of direct community forks.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{popular.length === 0 ? (
								<EmptyState />
							) : (
								popular.map((preset) => (
									<Card
										key={preset.id}
										className="border-slate-200/60 dark:border-zinc-800/60"
									>
										<CardHeader className="space-y-1">
											<CardTitle className="text-base">
												{preset.name}
											</CardTitle>
											<CardDescription>
												{preset.description ?? "No description yet."}
											</CardDescription>
										</CardHeader>
										<CardContent className="flex items-center justify-between text-xs text-muted-foreground">
											<span>@{preset.publisher.handle}</span>
											<span className="flex items-center gap-1">
												<GitFork className="h-3.5 w-3.5" />
								{preset.descendantCount} descendants
											</span>
										</CardContent>
									</Card>
								))
							)}
						</CardContent>
					</Card>
				</div>

				<Separator />

				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<div className="flex items-center gap-2">
						<ArrowLeft className="h-4 w-4" />
						<Link href="/" className="hover:text-foreground transition-colors">
							Back to home
						</Link>
					</div>
					<span>Public presets shown. Sign in to copy and customize.</span>
				</div>
			</div>
		</div>
	);
}

function MarketplaceCard({
	preset,
	tag,
}: {
	preset: MarketplacePreset;
	tag: string;
}) {
	return (
		<Card className="h-full">
			<CardHeader className="space-y-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">
						<Link
							href={`/gateway/marketplace/${preset.id}`}
							className="underline decoration-transparent hover:decoration-current transition-colors duration-200"
						>
							{preset.name}
						</Link>
					</CardTitle>
					<Badge variant="secondary">{tag}</Badge>
				</div>
				<CardDescription>{preset.description ?? "No description yet."}</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center justify-between text-xs text-muted-foreground">
				<span className="flex items-center gap-1">
					<BadgeCheck className="h-3.5 w-3.5" />
					@{preset.publisher.handle}
				</span>
				<span className="flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{preset.forkCount} direct · {preset.descendantCount} total</span>
			</CardContent>
		</Card>
	);
}

function CompactPresetRow({
	preset,
}: {
	preset: MarketplacePreset;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
			<div>
				<div className="font-medium text-sm">
					<Link
						href={`/gateway/marketplace/${preset.id}`}
						className="underline decoration-transparent hover:decoration-current transition-colors duration-200"
					>
						{preset.name}
					</Link>
				</div>
				<div className="text-xs text-muted-foreground">
					{preset.description ?? "No description yet."}
				</div>
			</div>
			<div className="text-right text-xs text-muted-foreground">
				<div>@{preset.publisher.handle}</div>
				<div className="flex items-center justify-end gap-1"><GitFork className="h-3.5 w-3.5" />{preset.forkCount} direct · {preset.descendantCount} total</div>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
			No public presets yet. Check back soon.
		</div>
	);
}
