"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { debounce, parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import {
	Activity,
	ArrowUpDown,
	AudioLines,
	BadgeAlert,
	Binary,
	CircleDollarSign,
	ExternalLink,
	Globe2,
	ImageIcon,
	Layers3,
	LayoutGrid,
	Search,
	Scale,
	SlidersHorizontal,
	Table2,
	Type,
	Video,
	type LucideIcon,
} from "lucide-react";
import APIProviderCard from "./APIProviderCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { ProviderModalityBadge } from "./ProviderModalityBadge";
import type {
	APIProviderCard as APIProviderCardType,
	ProviderModalityKey,
} from "@/lib/fetchers/api-providers/providerDataTypes";

interface APIProvidersDisplayProps {
	providers: APIProviderCardType[];
	showPrimaryHeader?: boolean;
}

type ProviderSortOption =
	| "a_z"
	| "daily_tokens_desc"
	| "total_models_desc"
	| "free_models_desc";

type FilterOption = { value: string; label: string; count: number; icon?: LucideIcon };

const SORT_OPTION_LABELS: Record<ProviderSortOption, string> = {
	daily_tokens_desc: "Most Used",
	total_models_desc: "Most Models",
	free_models_desc: "Most Free Models",
	a_z: "Name (A–Z)",
};

const MODALITIES: Array<{ value: ProviderModalityKey; label: string; icon: LucideIcon }> = [
	{ value: "text", label: "Text", icon: Type },
	{ value: "image", label: "Image", icon: ImageIcon },
	{ value: "video", label: "Video", icon: Video },
	{ value: "audio", label: "Audio", icon: AudioLines },
	{ value: "embedding", label: "Embeddings", icon: Binary },
	{ value: "moderation", label: "Moderation", icon: BadgeAlert },
];

const TRAINING_LABELS: Record<string, string> = {
	no_train: "No training",
	may_train: "May train",
	opt_out_available: "Opt-out available",
	enterprise_no_train: "Enterprise no-train",
};

const ZDR_LABELS: Record<string, string> = {
	default: "0 days",
	optional: "0 days available",
	unsupported: "No ZDR",
};

function policyLabel(value: string | null, labels: Record<string, string>): string {
	return value ? labels[value] ?? value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "Unknown";
}

const arrayParser = parseAsArrayOf(parseAsString).withDefault([]).withOptions({
	shallow: true,
	clearOnDefault: true,
});
const coverageParser = parseAsArrayOf(parseAsString).withDefault(["active"]).withOptions({
	shallow: true,
	clearOnDefault: true,
});

function normalizeSortOption(value: string | null | undefined): ProviderSortOption {
	switch (value) {
		case "daily_tokens_desc":
		case "total_models_desc":
		case "free_models_desc":
		case "a_z":
			return value;
		default:
			return "daily_tokens_desc";
	}
}

function toggleValue(values: string[], value: string) {
	return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function supportsModality(provider: APIProviderCardType, modality: ProviderModalityKey) {
	const support = provider.modality_support[modality];
	return Number(support?.input ?? 0) + Number(support?.output ?? 0) > 0;
}

function countryLabel(code: string) {
	if (!code) return "Unknown";
	try {
		return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
	} catch {
		return code.toUpperCase();
	}
}

function formatTokens(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "0";
	for (const unit of [
		{ value: 1_000_000_000_000, suffix: "T" },
		{ value: 1_000_000_000, suffix: "B" },
		{ value: 1_000_000, suffix: "M" },
		{ value: 1_000, suffix: "K" },
	]) {
		if (value >= unit.value) return `${(value / unit.value).toFixed(value / unit.value >= 100 ? 0 : 1).replace(/\.0$/, "")}${unit.suffix}`;
	}
	return Math.round(value).toLocaleString("en-US");
}

function ProviderFilterList({ options, selected, onToggle, showFlags = false }: {
	options: FilterOption[];
	selected: string[];
	onToggle: (value: string) => void;
	showFlags?: boolean;
}) {
	return (
		<div className="space-y-0.5 pb-2">
			{options.map((option) => {
				const Icon = option.icon;
				const checked = selected.includes(option.value);
				return (
					<button
						key={option.value}
						type="button"
						onClick={() => onToggle(option.value)}
						aria-pressed={checked}
						className={cn(
							"group flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-sm transition-colors",
							checked ? "bg-muted/45 text-foreground hover:bg-muted/55" : "hover:bg-muted/50",
						)}
					>
						<span className="flex min-w-0 items-center gap-2">
							{showFlags && option.value !== "unknown" ? (
								<Image src={`/flags/${option.value.toLowerCase()}.svg`} alt="" width={16} height={12} className="h-3 w-4 rounded-[2px] object-cover" />
							) : Icon ? <Icon className={cn("size-3.5 shrink-0", checked ? "text-primary" : "text-muted-foreground")} /> : null}
							<span className="truncate">{option.label}</span>
						</span>
						<span className={cn("shrink-0 text-xs tabular-nums", checked ? "text-foreground" : "text-muted-foreground")}>{option.count}</span>
					</button>
				);
			})}
		</div>
	);
}

export default function APIProvidersDisplay({ providers, showPrimaryHeader = true }: APIProvidersDisplayProps) {
	const pathname = usePathname();
	const isTable = pathname.endsWith("/table");
	const [search, setSearch] = useQueryState("search", { defaultValue: "", shallow: true });
	const deferredSearch = useDeferredValue(search);
	const [sort, setSort] = useQueryState("sort", { defaultValue: "daily_tokens_desc", shallow: true });
	const [modalities, setModalities] = useQueryState("modalities", arrayParser);
	const [coverage, setCoverage] = useQueryState("coverage", coverageParser);
	const [countries, setCountries] = useQueryState("countries", arrayParser);
	const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
	const [openSections, setOpenSections] = useState(["coverage", "modalities"]);
	const sortOption = normalizeSortOption(sort);

	const countryOptions = useMemo<FilterOption[]>(() => {
		const counts = new Map<string, number>();
		for (const provider of providers) {
			const code = provider.country_code?.trim().toLowerCase() || "unknown";
			counts.set(code, (counts.get(code) ?? 0) + 1);
		}
		return Array.from(counts, ([value, count]) => ({ value, count, label: value === "unknown" ? "Unknown" : countryLabel(value) }))
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [providers]);

	const modalityOptions = useMemo<FilterOption[]>(() => MODALITIES.map((item) => ({
		...item,
		count: providers.filter((provider) => supportsModality(provider, item.value)).length,
	})).filter((item) => item.count > 0), [providers]);

	const coverageOptions = useMemo<FilterOption[]>(() => [
		{ value: "active", label: "Gateway Providers", count: providers.filter((provider) => provider.is_gateway_provider).length, icon: Activity },
		{ value: "free", label: "Has Free Models", count: providers.filter((provider) => provider.free_models > 0).length, icon: CircleDollarSign },
	], [providers]);

	const filteredProviders = useMemo(() => {
		const query = deferredSearch.trim().toLowerCase();
		return [...providers]
			.filter((provider) => !query || provider.api_provider_name.toLowerCase().includes(query) || provider.api_provider_id.toLowerCase().includes(query))
			.filter((provider) => modalities.length === 0 || modalities.every((value) => supportsModality(provider, value as ProviderModalityKey)))
			.filter((provider) => countries.length === 0 || countries.includes(provider.country_code?.trim().toLowerCase() || "unknown"))
			.filter((provider) => coverage.length === 0 || coverage.every((value) => value === "active" ? provider.is_gateway_provider : provider.free_models > 0))
			.sort((a, b) => {
				if (sortOption === "daily_tokens_desc") {
					const delta = Number(b.total_daily_tokens ?? 0) - Number(a.total_daily_tokens ?? 0);
					if (delta) return delta;
					const monthlyDelta = Number(b.total_monthly_tokens ?? 0) - Number(a.total_monthly_tokens ?? 0);
					if (monthlyDelta) return monthlyDelta;
				}
				if (sortOption === "total_models_desc") {
					const delta = Number(b.total_models ?? 0) - Number(a.total_models ?? 0);
					if (delta) return delta;
				}
				if (sortOption === "free_models_desc") {
					const delta = Number(b.free_models ?? 0) - Number(a.free_models ?? 0);
					if (delta) return delta;
				}
				return a.api_provider_name.localeCompare(b.api_provider_name);
			});
	}, [countries, coverage, deferredSearch, modalities, providers, sortOption]);

	const customCoverageCount = coverage.length === 1 && coverage[0] === "active" ? 0 : coverage.length;
	const activeFilterCount = modalities.length + customCoverageCount + countries.length;
	const resetFilters = () => { void setModalities([]); void setCoverage(["active"]); void setCountries([]); };
	const filtersContent = (
		<Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
			<AccordionItem value="coverage" className="border-border/70">
				<AccordionTrigger className="px-2 py-3 text-sm hover:no-underline"><span className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" />Gateway Coverage</span></AccordionTrigger>
				<AccordionContent disableAnimation><ProviderFilterList options={coverageOptions} selected={coverage} onToggle={(value) => void setCoverage(toggleValue(coverage, value))} /></AccordionContent>
			</AccordionItem>
			<AccordionItem value="modalities" className="border-border/70">
				<AccordionTrigger className="px-2 py-3 text-sm hover:no-underline"><span className="flex items-center gap-2"><Layers3 className="size-4 text-muted-foreground" />Modalities</span></AccordionTrigger>
				<AccordionContent disableAnimation><ProviderFilterList options={modalityOptions} selected={modalities} onToggle={(value) => void setModalities(toggleValue(modalities, value))} /></AccordionContent>
			</AccordionItem>
			<AccordionItem value="headquarters" className="border-border/70">
				<AccordionTrigger className="px-2 py-3 text-sm hover:no-underline"><span className="flex items-center gap-2"><Globe2 className="size-4 text-muted-foreground" />Headquarters</span></AccordionTrigger>
				<AccordionContent disableAnimation><ProviderFilterList options={countryOptions} selected={countries} onToggle={(value) => void setCountries(toggleValue(countries, value))} showFlags /></AccordionContent>
			</AccordionItem>
		</Accordion>
	);

	const lgFillers = (2 - (filteredProviders.length % 2)) % 2;
	const twoXlFillers = (3 - (filteredProviders.length % 3)) % 3;
	const viewSwitcher = (
		<div className="inline-flex h-8 shrink-0 overflow-hidden rounded-md border border-border/70 bg-background shadow-xs">
			<Link href="/api-providers" prefetch={false} aria-label="Card view" aria-current={!isTable ? "page" : undefined} className={cn("inline-flex w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground", !isTable && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}><LayoutGrid className="size-4" /></Link>
			<Link href="/api-providers/table" prefetch={false} aria-label="Table view" aria-current={isTable ? "page" : undefined} className={cn("inline-flex w-9 items-center justify-center border-l border-border/70 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground", isTable && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}><Table2 className="size-4" /></Link>
		</div>
	);
	return (
		<div className="flex w-full flex-1">
			<aside className="hidden w-[20rem] shrink-0 border-r border-border/70 bg-background/95 lg:block">
				<div className="sticky top-16 flex h-[calc(100dvh-4rem)] min-h-0 flex-col">
					<div className="flex h-11 items-center justify-between border-b border-border/70 px-4">
						<span className="text-xs font-medium text-muted-foreground">Filter Providers</span>
						{activeFilterCount ? <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetFilters}>Reset</Button> : null}
					</div>
					<ScrollArea className="min-h-0 flex-1 overscroll-y-contain"><div className="px-4 pb-6 pt-2">{filtersContent}</div></ScrollArea>
				</div>
			</aside>

			<section className="min-w-0 flex flex-1 flex-col">
				<div className="z-40 border-b border-border/70 bg-background/95 px-4 pb-2 pt-2.5 backdrop-blur md:sticky md:top-[3.75rem] lg:px-8">
					<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						{showPrimaryHeader ? <h1 className="text-xl font-bold">Providers</h1> : <div className="hidden md:block" />}
						<div className="flex min-w-0 flex-1 items-center gap-2 md:max-w-[42rem] md:justify-end">
							<div className="relative min-w-0 flex-1">
								<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input placeholder="Search providers" value={search} onChange={(event) => void setSearch(event.target.value, { limitUrlUpdates: debounce(250) })} className="h-8 w-full rounded-md border-border bg-background pl-9 text-sm" />
							</div>
							<Select value={sortOption} onValueChange={(value) => void setSort(normalizeSortOption(value))}>
								<SelectTrigger className="h-8 w-[10.5rem] rounded-md border-border bg-background text-sm" aria-label="Sort providers"><span className="flex min-w-0 items-center gap-2"><ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{SORT_OPTION_LABELS[sortOption]}</span></span></SelectTrigger>
								<SelectContent align="end">{(Object.keys(SORT_OPTION_LABELS) as ProviderSortOption[]).map((option) => <SelectItem key={option} value={option}>{SORT_OPTION_LABELS[option]}</SelectItem>)}</SelectContent>
							</Select>
							{viewSwitcher}
							<Button asChild variant="outline" size="sm" className="h-8 rounded-md px-2.5"><Link href="/api-providers/compare" prefetch={false}><Scale className="size-3.5" /><span className="hidden sm:inline">Compare</span></Link></Button>
							<Button variant="outline" size="sm" className="relative h-8 rounded-md px-2 lg:hidden" onClick={() => setMobileFiltersOpen(true)}><SlidersHorizontal className="size-3.5" /><span className="sr-only">Filters</span>{activeFilterCount ? <span className="absolute -right-1 -top-1 min-w-4 rounded-sm bg-primary px-1 text-[10px] text-primary-foreground">{activeFilterCount}</span> : null}</Button>
						</div>
					</div>
					<div className="mt-2 text-xs text-muted-foreground">{filteredProviders.length.toLocaleString()} of {providers.length.toLocaleString()} providers</div>
				</div>

				<div className="px-4 py-5 lg:px-8">
					<div className={cn("overflow-hidden", isTable ? "rounded-md border border-border/70 bg-background" : "bg-border/70")}>
						{filteredProviders.length && isTable ? (
							<ScrollArea className="w-full" scrollBarOrientation="horizontal" keepScrollbarMounted viewportClassName="pb-2">
								<Table wrapInContainer={false} className="min-w-[1400px] text-xs">
									<TableHeader><TableRow className="h-9"><TableHead className="w-[240px]">Provider</TableHead><TableHead>Headquarters</TableHead><TableHead className="text-center">Models</TableHead><TableHead className="text-center">Free Models</TableHead><TableHead>Modalities</TableHead><TableHead className="text-center">Daily Tokens</TableHead><TableHead className="text-center">Monthly Tokens</TableHead><TableHead>Training</TableHead><TableHead>Retention</TableHead><TableHead>Privacy</TableHead><TableHead>Terms</TableHead></TableRow></TableHeader>
									<TableBody>{filteredProviders.map((provider) => {
										const supported = MODALITIES.filter((modality) => supportsModality(provider, modality.value));
										return <TableRow key={provider.api_provider_id} className="h-11 hover:bg-muted/35">
											<TableCell className="py-0"><Link href={`/api-providers/${provider.api_provider_id}`} prefetch={false} className="inline-flex h-11 min-w-0 items-center gap-2 font-medium leading-none hover:underline hover:underline-offset-4"><span className="relative size-6 shrink-0"><Logo id={provider.api_provider_id} alt={provider.api_provider_name} fill className="object-contain" /></span><span className="truncate leading-none">{provider.api_provider_name}</span></Link></TableCell>
											<TableCell>{provider.country_code ? <Link href={`/countries/${provider.country_code.toLowerCase()}`} prefetch={false} className="inline-flex items-center gap-2 hover:underline hover:underline-offset-4"><Image src={`/flags/${provider.country_code.toLowerCase()}.svg`} alt="" width={16} height={12} className="h-3 w-4 rounded-[2px] object-cover" />{countryLabel(provider.country_code)}</Link> : "—"}</TableCell>
											<TableCell className="text-center tabular-nums">{provider.total_models.toLocaleString()}</TableCell>
											<TableCell className="text-center tabular-nums">{provider.free_models ? provider.free_models.toLocaleString() : "—"}</TableCell>
											<TableCell><div className="flex items-center gap-1.5">{supported.map(({ value, icon: Icon, label }) => <ProviderModalityBadge key={value} label={label} modality={value} icon={Icon} inputCount={provider.modality_support[value]?.input ?? 0} outputCount={provider.modality_support[value]?.output ?? 0} />)}</div></TableCell>
											<TableCell className="text-center font-medium tabular-nums">{formatTokens(Number(provider.total_daily_tokens))}</TableCell>
											<TableCell className="text-center font-medium tabular-nums">{formatTokens(Number(provider.total_monthly_tokens))}</TableCell>
											<TableCell className={cn("whitespace-nowrap", !provider.prompt_training_policy && "text-muted-foreground")}>{policyLabel(provider.prompt_training_policy, TRAINING_LABELS)}</TableCell>
											<TableCell className={cn("whitespace-nowrap", !provider.zero_data_retention && "text-muted-foreground")}>{policyLabel(provider.zero_data_retention, ZDR_LABELS)}</TableCell>
											<TableCell>{provider.privacy_policy_url ? <a href={provider.privacy_policy_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline hover:underline-offset-4">Privacy <ExternalLink className="size-3 text-muted-foreground" /></a> : <span className="text-muted-foreground">—</span>}</TableCell>
											<TableCell>{provider.terms_of_service_url ? <a href={provider.terms_of_service_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline hover:underline-offset-4">Terms <ExternalLink className="size-3 text-muted-foreground" /></a> : <span className="text-muted-foreground">—</span>}</TableCell>
										</TableRow>;
									})}</TableBody>
								</Table>
							</ScrollArea>
						) : filteredProviders.length ? <div className="grid grid-cols-1 gap-px lg:grid-cols-2 2xl:grid-cols-3">
							{filteredProviders.map((provider) => <div key={provider.api_provider_id} className="bg-background"><APIProviderCard api_provider={provider} /></div>)}
							{Array.from({ length: lgFillers }).map((_, index) => <div key={`lg-filler-${index}`} aria-hidden className="hidden bg-background lg:block 2xl:hidden" />)}
							{Array.from({ length: twoXlFillers }).map((_, index) => <div key={`2xl-filler-${index}`} aria-hidden className="hidden bg-background 2xl:block" />)}
						</div> : <div className="flex min-h-64 flex-col items-center justify-center gap-2 bg-background px-4 text-center"><Search className="size-5 text-muted-foreground" /><p className="text-sm font-medium">No providers found</p><p className="text-xs text-muted-foreground">Try changing your search or filters.</p>{activeFilterCount ? <Button variant="outline" size="sm" className="mt-2 rounded-md" onClick={resetFilters}>Reset Filters</Button> : null}</div>}
					</div>
				</div>
			</section>

			<Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
				<SheetContent side="right" className="flex w-[min(24rem,92vw)] flex-col p-0">
					<SheetHeader className="border-b border-border/70 px-4 py-3"><SheetTitle>Provider Filters</SheetTitle><SheetDescription>Narrow providers by gateway coverage and capability.</SheetDescription></SheetHeader>
					<ScrollArea className="min-h-0 flex-1"><div className="px-4 pb-8 pt-2">{filtersContent}</div></ScrollArea>
					{activeFilterCount ? <div className="border-t border-border/70 p-3"><Button variant="outline" className="w-full rounded-md" onClick={resetFilters}>Reset Filters</Button></div> : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}
