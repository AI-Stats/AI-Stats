"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { useQueryState } from "nuqs";
import {
	Activity,
	ArrowLeft,
	Bot,
	Box,
	Check,
	CircleCheck,
	CircleX,
	Cloud,
	Code2,
	Gauge,
	Globe2,
	Hash,
	KeyRound,
	ListFilter,
	Loader2,
	MonitorSmartphone,
	Plus,
	Radio,
	Route,
	Server,
	X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { shortenIdentifier } from "@/lib/gateway/usage/timeFormatting";
import type {
	AppMetadata,
	ProviderMetadataEntry,
} from "@/app/(dashboard)/gateway/usage/server-actions";
import { getModelDisplayName, type ModelMetadataMap } from "./model-display";
import type { UsageLogsViewKey } from "@/lib/gateway/usage/timeRange";

type FilterOption = {
	value: string;
	label: string;
	logoId?: string | null;
	count?: number;
	group?: string;
};

// Client source is a finite gateway-owned taxonomy, unlike models and
// providers, so the complete set remains discoverable without scanning the
// request log to calculate exact counts.
const SOURCE_LANGUAGE_LABELS = {
	typescript: "TypeScript", python: "Python", go: "Go", java: "Java",
	csharp: "C#", cpp: "C++", php: "PHP", ruby: "Ruby", rust: "Rust",
} as const;
const SUPPORTED_CLIENT_SOURCES: ReadonlyArray<FilterOption> = [
	{ value: "api", label: "Direct HTTP", group: "HTTP clients" },
	{ value: "codex", label: "Codex", logoId: "codex", group: "Coding agents" },
	{ value: "claude-code", label: "Claude Code", logoId: "claudecode", group: "Coding agents" },
	...(["typescript", "python", "go", "java", "csharp", "cpp", "php", "ruby", "rust"] as const).map((language) => ({ value: `phaseo-${language}`, label: `Phaseo ${SOURCE_LANGUAGE_LABELS[language]} SDK`, logoId: "phaseo", group: "Phaseo SDKs" })),
	...(["typescript", "python", "go", "java", "csharp", "php", "ruby", "rust"] as const).map((language) => ({ value: `phaseo-agent-${language}`, label: `Phaseo Agent ${SOURCE_LANGUAGE_LABELS[language]} SDK`, logoId: "phaseo", group: "Phaseo Agent SDKs" })),
	{ value: "openai-typescript", label: "OpenAI TypeScript SDK", logoId: "openai", group: "Compatible SDKs" },
	{ value: "openai-python", label: "OpenAI Python SDK", logoId: "openai", group: "Compatible SDKs" },
	{ value: "anthropic-typescript", label: "Anthropic TypeScript SDK", logoId: "anthropic", group: "Compatible SDKs" },
	{ value: "anthropic-python", label: "Anthropic Python SDK", logoId: "anthropic", group: "Compatible SDKs" },
	{ value: "curl", label: "cURL", group: "HTTP clients" },
	{ value: "httpie", label: "HTTPie", group: "HTTP clients" },
	{ value: "postman", label: "Postman", group: "HTTP clients" },
	{ value: "insomnia", label: "Insomnia", group: "HTTP clients" },
	{ value: "axios", label: "Axios", group: "HTTP clients" },
	{ value: "python-requests", label: "Python Requests", logoId: "python", group: "HTTP clients" },
];

const OPERATOR_LABELS: Record<string, string> = {
	is: "Is",
	is_not: "Is not",
	eq: "Equals",
	gte: "At least",
	lte: "At most",
	between: "Between",
};

function NumericFilterEditor({ label, initialValue, initialMax, initialOperator, onApply }: {
	label: string;
	initialValue: string;
	initialMax: string;
	initialOperator: string;
	onApply: (value: string, max: string, operator: string) => void;
}) {
	const t = useTranslations("SettingsUI");
	const [value, setValue] = React.useState(initialValue);
	const [max, setMax] = React.useState(initialMax);
	const [operator, setOperator] = React.useState(initialOperator || "gte");
	const valid = /^\d+$/.test(value) && (operator !== "between" || (/^\d+$/.test(max) && Number(max) >= Number(value)));
	return (
		<div className="space-y-3 p-3">
			<div className="grid grid-cols-2 gap-1 rounded-md bg-muted/40 p-1">
				{["gte", "lte", "eq", "between"].map((item) => (
					<button key={item} type="button" onClick={() => setOperator(item)} className={`h-8 rounded-md px-2 text-xs ${operator === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>
					{t(`strings.${OPERATOR_LABELS[item]}` as never)}
					</button>
				))}
			</div>
			<div className="flex items-center gap-2">
				<input inputMode="numeric" pattern="[0-9]*" value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))} placeholder="0" aria-label={`${label} value`} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
				{operator === "between" ? <><span className="text-xs text-muted-foreground">{t("strings.and" as never)}</span><input inputMode="numeric" pattern="[0-9]*" value={max} onChange={(event) => setMax(event.target.value.replace(/\D/g, ""))} placeholder="0" aria-label={`${label} maximum`} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring" /></> : null}
			</div>
			<Button type="button" size="sm" className="w-full rounded-md" disabled={!valid} onClick={() => onApply(value, max, operator)}>{t("strings.Apply Filter" as never)}</Button>
		</div>
	);
}

const FILTER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	source: MonitorSmartphone,
	model: Bot,
	provider: Cloud,
	app: Box,
	endpoint: Route,
	finish: CircleCheck,
	stream: Radio,
	error: CircleX,
	http: Globe2,
	key: KeyRound,
	status: Activity,
	kind: Code2,
	session: Hash,
	latency: Gauge,
	throughput: Gauge,
	generation: Server,
	input_tokens: Gauge,
	output_tokens: Gauge,
	total_tokens: Gauge,
};

function FilterChip({
	label,
	value,
	onClear,
	filterKey = label.toLowerCase().replaceAll(" ", "_"),
	valueLogoId,
	onValueClick,
	valueOptions,
	activeValue,
	onValueSelect,
	operatorOptions = ["is", "is_not"],
	defaultOperator = "is",
}: {
	label: string;
	value: React.ReactNode;
	onClear: () => void;
	filterKey?: string;
	valueLogoId?: string | null;
	onValueClick?: () => void;
	valueOptions?: FilterOption[];
	activeValue?: string;
	onValueSelect?: (value: string) => void | Promise<unknown>;
	operatorOptions?: string[];
	defaultOperator?: string;
}) {
	const t = useTranslations("SettingsUI");
	const [operator, setOperator] = useQueryState(`${filterKey}_op`, {
		defaultValue: defaultOperator,
		shallow: false,
	});
	const [valuePickerOpen, setValuePickerOpen] = React.useState(false);
	const FilterIcon = FILTER_ICONS[filterKey] ?? ListFilter;
	return (
		<div className="inline-flex h-8 max-w-full items-stretch overflow-hidden rounded-md border border-border/70 bg-muted/20 text-xs">
			<span className="inline-flex items-center gap-1.5 rounded-l-md rounded-r-none border-r border-border/70 px-2 text-foreground">
				<FilterIcon className="size-3.5 text-muted-foreground" />
				{label}
			</span>
			<Popover>
				<PopoverTrigger asChild>
					<button data-settings-segment type="button" className="inline-flex h-full appearance-none items-center rounded-none border-r border-border/70 px-2 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-0">
						{OPERATOR_LABELS[operator] ? t(`strings.${OPERATOR_LABELS[operator]}` as never) : operator}
					</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-36 gap-0 rounded-md p-1">
					{operatorOptions.map((nextOperator) => (
						<button key={nextOperator} type="button" onClick={() => void setOperator(nextOperator)} className="flex h-8 w-full items-center rounded-sm px-2 text-left text-xs hover:bg-muted">
							<span className="flex-1">{OPERATOR_LABELS[nextOperator] ? t(`strings.${OPERATOR_LABELS[nextOperator]}` as never) : nextOperator}</span>
							{operator === nextOperator ? <Check className="size-3.5" /> : null}
						</button>
					))}
				</PopoverContent>
			</Popover>
			{valueOptions && onValueSelect ? (
				<Popover open={valuePickerOpen} onOpenChange={setValuePickerOpen}>
					<PopoverTrigger asChild>
						<button data-settings-segment type="button" className="inline-flex min-w-0 max-w-[min(320px,50vw)] appearance-none items-center gap-1.5 rounded-none px-2 text-foreground hover:bg-muted">
							{valueLogoId ? <Logo id={valueLogoId} width={14} height={14} className="shrink-0 rounded-sm" /> : null}
							<span className="truncate">{value}</span>
						</button>
					</PopoverTrigger>
					<PopoverContent side="bottom" align="start" sideOffset={6} className="w-[320px] gap-0 overflow-hidden rounded-md p-0">
						<Command className="rounded-md">
							<CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
							<CommandList className="max-h-none overflow-hidden">
								<ScrollArea className="h-[320px]" keepScrollbarMounted viewportClassName="pr-2">
								<CommandEmpty>{t("strings.No matching options." as never)}</CommandEmpty>
									<CommandGroup>
										{valueOptions.map((option) => (
											<CommandItem key={option.value} value={`${option.label} ${option.value}`} data-checked={activeValue === option.value} onSelect={() => { void onValueSelect(option.value); setValuePickerOpen(false); }}>
												{option.logoId ? <Logo id={option.logoId} width={14} height={14} className="shrink-0 rounded-sm" /> : null}
								<span className="min-w-0 flex-1 truncate">{option.label}</span>
											</CommandItem>
										))}
									</CommandGroup>
								</ScrollArea>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			) : onValueClick ? (
				<button data-settings-segment type="button" onClick={onValueClick} className="inline-flex min-w-0 max-w-[min(320px,50vw)] appearance-none items-center gap-1.5 rounded-none px-2 text-foreground hover:bg-muted">
					{valueLogoId ? <Logo id={valueLogoId} width={14} height={14} className="shrink-0 rounded-sm" /> : null}
					<span className="truncate">{value}</span>
				</button>
			) : (
				<span className="inline-flex min-w-0 max-w-[min(320px,50vw)] items-center gap-1.5 px-2 text-foreground">
					{valueLogoId ? <Logo id={valueLogoId} width={14} height={14} className="shrink-0 rounded-sm" /> : null}
					<span className="truncate">{value}</span>
				</span>
			)}
			<button data-settings-segment type="button" onClick={onClear} className="inline-flex h-full appearance-none items-center rounded-l-none rounded-r-md border-l border-border/70 px-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Clear ${label} filter`}>
				<X className="size-3" />
			</button>
		</div>
	);
}

export default function UsageViewFilters({
	view,
	models = [],
	providers = [],
	logAppIds = [],
	logEndpoints = [],
	logFinishReasons = [],
	logErrorCodes = [],
	logStatusCodes = [],
	clientSources = [],
	modelProviders = new Map(),
	providerNames = new Map(),
	apiKeys = [],
	modelMetadata = new Map(),
	providerMetadata = new Map<string, ProviderMetadataEntry>(),
	appMetadata = new Map<string, AppMetadata>(),
	sessionAppIds = [],
	sessionModelIds = [],
	sessionProviderIds = [],
	lockJobKind = false,
}: {
	view: UsageLogsViewKey;
	models?: string[];
	providers?: string[];
	logAppIds?: string[];
	logEndpoints?: string[];
	logFinishReasons?: string[];
	logErrorCodes?: string[];
	logStatusCodes?: number[];
	clientSources?: Array<{ id: string; name: string }>;
	modelProviders?: Map<string, string[]>;
	providerNames?: Map<string, string>;
	apiKeys?: { id: string; name: string | null; prefix: string | null }[];
	modelMetadata?: ModelMetadataMap;
	providerMetadata?: Map<string, ProviderMetadataEntry>;
	appMetadata?: Map<string, AppMetadata>;
	sessionAppIds?: string[];
	sessionModelIds?: string[];
	sessionProviderIds?: string[];
	lockJobKind?: boolean;
}) {
	const t = useTranslations("SettingsUI");
	const [filtersPending, startFilterTransition] = React.useTransition();
	const queryOptions = { shallow: false, startTransition: startFilterTransition } as const;
	const [modelFilter, setModelFilter] = useQueryState("model", { ...queryOptions, defaultValue: "" });
	const [providerFilter, setProviderFilter] = useQueryState("provider", { ...queryOptions, defaultValue: "" });
	const [appFilter, setAppFilter] = useQueryState("app", { ...queryOptions, defaultValue: "" });
	const [endpointFilter, setEndpointFilter] = useQueryState("endpoint", { ...queryOptions, defaultValue: "" });
	const [finishReasonFilter, setFinishReasonFilter] = useQueryState("finish_reason", { ...queryOptions, defaultValue: "" });
	const [streamFilter, setStreamFilter] = useQueryState("stream", { ...queryOptions, defaultValue: "all" });
	const [errorCodeFilter, setErrorCodeFilter] = useQueryState("error_code", { ...queryOptions, defaultValue: "" });
	const [statusCodeFilter, setStatusCodeFilter] = useQueryState("http_status", { ...queryOptions, defaultValue: "" });
	const [keyFilter, setKeyFilter] = useQueryState("key", { ...queryOptions, defaultValue: "" });
	const [statusFilter, setStatusFilter] = useQueryState("status", { ...queryOptions, defaultValue: "all" });
	const [requestFilter, setRequestFilter] = useQueryState("req", { ...queryOptions, defaultValue: "" });
	const [sessionFilter, setSessionFilter] = useQueryState("session", { ...queryOptions, defaultValue: "" });
	const [sourceFilter, setSourceFilter] = useQueryState("source", { ...queryOptions, defaultValue: "" });
	const [inputTokensFilter, setInputTokensFilter] = useQueryState("input_tokens", { ...queryOptions, defaultValue: "" });
	const [inputTokensMax, setInputTokensMax] = useQueryState("input_tokens_max", { ...queryOptions, defaultValue: "" });
	const [inputTokensOperator, setInputTokensOperator] = useQueryState("input_tokens_op", { ...queryOptions, defaultValue: "gte" });
	const [outputTokensFilter, setOutputTokensFilter] = useQueryState("output_tokens", { ...queryOptions, defaultValue: "" });
	const [outputTokensMax, setOutputTokensMax] = useQueryState("output_tokens_max", { ...queryOptions, defaultValue: "" });
	const [outputTokensOperator, setOutputTokensOperator] = useQueryState("output_tokens_op", { ...queryOptions, defaultValue: "gte" });
	const [totalTokensFilter, setTotalTokensFilter] = useQueryState("total_tokens", { ...queryOptions, defaultValue: "" });
	const [totalTokensMax, setTotalTokensMax] = useQueryState("total_tokens_max", { ...queryOptions, defaultValue: "" });
	const [totalTokensOperator, setTotalTokensOperator] = useQueryState("total_tokens_op", { ...queryOptions, defaultValue: "gte" });

	const [jobKindFilter, setJobKindFilter] = useQueryState("job_kind", { defaultValue: "", shallow: false });
	const [jobStatusFilter, setJobStatusFilter] = useQueryState("job_status", { defaultValue: "", shallow: false });
	const [jobProviderFilter, setJobProviderFilter] = useQueryState("job_provider", { defaultValue: "", shallow: false });

	const [sessionAppFilter, setSessionAppFilter] = useQueryState("session_app", { defaultValue: "", shallow: false });
	const [sessionModelFilter, setSessionModelFilter] = useQueryState("session_model", { defaultValue: "", shallow: false });
	const [sessionProviderFilter, setSessionProviderFilter] = useQueryState("session_provider", { defaultValue: "", shallow: false });
	const [pickerOpen, setPickerOpen] = React.useState(false);
	const [selectedFilterType, setSelectedFilterType] = React.useState<string | null>(null);
	const pickerViewportRef = React.useRef<HTMLDivElement | null>(null);
	const pickerScrollPositions = React.useRef(new Map<string, number>());
	const [filterBarTarget, setFilterBarTarget] = React.useState<HTMLElement | null>(null);
	const changeSelectedFilterType = React.useCallback((next: string | null) => {
		if (pickerViewportRef.current) {
			pickerScrollPositions.current.set(selectedFilterType ?? "root", pickerViewportRef.current.scrollTop);
		}
		setSelectedFilterType(next);
	}, [selectedFilterType]);
	React.useLayoutEffect(() => {
		if (!pickerOpen) return;
		const frame = requestAnimationFrame(() => {
			if (pickerViewportRef.current) {
				pickerViewportRef.current.scrollTop = pickerScrollPositions.current.get(selectedFilterType ?? "root") ?? 0;
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [pickerOpen, selectedFilterType]);
	React.useEffect(() => {
		const syncFilterBarTarget = () => {
			const nextTarget = document.getElementById("usage-log-active-filters");
			setFilterBarTarget((currentTarget) =>
				currentTarget === nextTarget ? currentTarget : nextTarget,
			);
		};

		syncFilterBarTarget();
		const observer = new MutationObserver(syncFilterBarTarget);
		observer.observe(document.body, { childList: true, subtree: true });

		return () => observer.disconnect();
	}, []);

	const modelOptions = React.useMemo(() => {
		return models
			.map((modelId) => ({
				value: modelId,
				label: getModelDisplayName(modelId, modelMetadata),
				logoId: modelMetadata.get(modelId)?.organisationId ?? null,
			}))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
	}, [modelMetadata, models]);

	const providerOptions = React.useMemo(() => {
		return providers
			.map((providerId) => ({
				value: providerId,
				label:
					providerNames.get(providerId) ??
					providerMetadata.get(providerId)?.name ??
					providerId,
				logoId: providerId,
			}))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
	}, [providerMetadata, providerNames, providers]);

	const keyOptions = React.useMemo(() => {
		return apiKeys.map((key) => ({
			value: key.id,
			label: key.name || key.prefix || key.id.slice(0, 8),
		}));
	}, [apiKeys]);

	const logAppOptions = React.useMemo(() => {
		return logAppIds
			.map((appId) => ({
				value: appId,
				label: appMetadata.get(appId)?.title?.trim() || appId,
			}))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
	}, [appMetadata, logAppIds]);

	const endpointOptions = React.useMemo(() => {
		return logEndpoints.map((endpoint) => ({
			value: endpoint,
			label: endpoint,
		}));
	}, [logEndpoints]);

	const finishReasonOptions = React.useMemo(() => {
		return logFinishReasons.map((finishReason) => ({
			value: finishReason,
			label: finishReason,
		}));
	}, [logFinishReasons]);

	const errorCodeOptions = React.useMemo(() => {
		return logErrorCodes.map((errorCode) => ({
			value: errorCode,
			label: errorCode,
		}));
	}, [logErrorCodes]);

	const statusCodeOptions = React.useMemo(() => {
		return logStatusCodes.map((statusCode) => ({
			value: String(statusCode),
			label: String(statusCode),
		}));
	}, [logStatusCodes]);

	const clientSourceOptions = React.useMemo(() => {
		const discoveredSources = new Map(clientSources.map((source) => [source.id, source.name]));
		const supportedIds = new Set(SUPPORTED_CLIENT_SOURCES.map((source) => source.value));
		return [
			...SUPPORTED_CLIENT_SOURCES.map((source) => ({
				...source,
				label: discoveredSources.get(source.value) ?? source.label,
			})),
			...clientSources
				.filter((source) => !supportedIds.has(source.id))
				.map((source) => ({
					value: source.id,
					label: source.name,
				})),
		];
	}, [clientSources]);

	const sessionAppOptions = React.useMemo(() => {
		return sessionAppIds
			.map((appId) => ({
				value: appId,
				label: appMetadata.get(appId)?.title?.trim() || appId,
			}))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
	}, [appMetadata, sessionAppIds]);

	const sessionModelOptions = React.useMemo(() => {
		return sessionModelIds
			.map((modelId) => ({
				value: modelId,
				label: getModelDisplayName(modelId, modelMetadata),
				logoId: modelMetadata.get(modelId)?.organisationId ?? null,
			}))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
	}, [modelMetadata, sessionModelIds]);

	const sessionProviderOptions = React.useMemo(() => {
		return sessionProviderIds
			.map((providerId) => ({
				value: providerId,
				label:
					providerNames.get(providerId) ??
					providerMetadata.get(providerId)?.name ??
					providerId,
				logoId: providerId,
			}))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
	}, [providerMetadata, providerNames, sessionProviderIds]);

	const statusOptions: FilterOption[] = [
		{ value: "success", label: "Successful only" },
		{ value: "error", label: "Errors only" },
	];

	const streamOptions: FilterOption[] = [
		{ value: "streaming", label: "Streaming only" },
		{ value: "non_streaming", label: "Non-streaming only" },
	];

	const jobKindOptions: FilterOption[] = [
		{ value: "video", label: "Video" },
		{ value: "batch", label: "Batch" },
	];

	const jobStatusOptions: FilterOption[] = [
		{ value: "pending", label: "Queued" },
		{ value: "in_progress", label: "Processing" },
		{ value: "completed", label: "Completed" },
		{ value: "failed", label: "Failed" },
		{ value: "cancelled", label: "Cancelled" },
		{ value: "expired", label: "Expired" },
	];
	const editFilterValue = (filterId: string) => {
		changeSelectedFilterType(filterId);
		setPickerOpen(true);
	};

	const activeChips: React.ReactNode[] = [];

	if (view === "logs" || view === "upstream") {
		if (modelFilter) {
			activeChips.push(
				<FilterChip
					key="model"
					label="Model"
					value={getModelDisplayName(modelFilter, modelMetadata)}
					valueLogoId={modelMetadata.get(modelFilter)?.organisationId}
					valueOptions={modelOptions}
					activeValue={modelFilter}
					onValueSelect={setModelFilter}
					onClear={() => setModelFilter("")}
				/>,
			);
		}
		if (providerFilter) {
			activeChips.push(
				<FilterChip
					key="provider"
					label="Provider"
					valueLogoId={providerFilter}
					valueOptions={providerOptions}
					activeValue={providerFilter}
					onValueSelect={setProviderFilter}
					value={
						providerNames.get(providerFilter) ??
						providerMetadata.get(providerFilter)?.name ??
						providerFilter
					}
					onClear={() => setProviderFilter("")}
				/>,
			);
		}
		if (view === "logs" && appFilter) {
			activeChips.push(
				<FilterChip
					key="app"
					label="App"
					value={appMetadata.get(appFilter)?.title?.trim() || appFilter}
					onValueClick={() => editFilterValue("app")}
					onClear={() => setAppFilter("")}
				/>,
			);
		}
		if (view === "logs" && endpointFilter) {
			activeChips.push(
				<FilterChip
					key="endpoint"
					label="Endpoint"
					value={<code className="font-mono text-[11px]">{endpointFilter}</code>}
					onValueClick={() => editFilterValue("endpoint")}
					onClear={() => setEndpointFilter("")}
				/>,
			);
		}
		if (view === "logs" && finishReasonFilter) {
			activeChips.push(
				<FilterChip
					key="finish-reason"
					label="Finish"
					filterKey="finish"
					value={finishReasonFilter}
					onValueClick={() => editFilterValue("finish")}
					onClear={() => setFinishReasonFilter("")}
				/>,
			);
		}
		if (view === "logs" && streamFilter !== "all") {
			activeChips.push(
				<FilterChip
					key="stream"
					label="Stream"
					value={
						streamFilter === "streaming"
							? "Streaming only"
							: "Non-streaming only"
					}
					onValueClick={() => editFilterValue("stream")}
					onClear={() => setStreamFilter("all")}
				/>,
			);
		}
		if (view === "logs" && errorCodeFilter) {
			activeChips.push(
				<FilterChip
					key="error-code"
					label="Error"
					filterKey="error"
					value={<code className="font-mono text-[11px]">{errorCodeFilter}</code>}
					onValueClick={() => editFilterValue("error")}
					onClear={() => setErrorCodeFilter("")}
				/>,
			);
		}
		if (view === "logs" && statusCodeFilter) {
			activeChips.push(
				<FilterChip
					key="status-code"
					label="HTTP"
					filterKey="http"
					value={<code className="font-mono text-[11px]">{statusCodeFilter}</code>}
					onValueClick={() => editFilterValue("http")}
					onClear={() => setStatusCodeFilter("")}
				/>,
			);
		}
		if (keyFilter) {
			const keyLabel =
				apiKeys.find((key) => key.id === keyFilter)?.name ||
				apiKeys.find((key) => key.id === keyFilter)?.prefix ||
				keyFilter.slice(0, 8);
			activeChips.push(
				<FilterChip key="key" label="Key" value={keyLabel} onValueClick={() => editFilterValue("key")} onClear={() => setKeyFilter("")} />,
			);
		}
		if (statusFilter !== "all") {
			activeChips.push(
				<FilterChip
					key="status"
					label="Status"
					value={statusFilter === "success" ? "Successful only" : "Errors only"}
					onValueClick={() => editFilterValue("status")}
					onClear={() => setStatusFilter("all")}
				/>,
			);
		}
		if (view === "logs" && requestFilter) {
			activeChips.push(
				<FilterChip
					key="req"
					label="Req"
					value={<code className="font-mono text-[11px]">{shortenIdentifier(requestFilter, 6)}</code>}
					onClear={() => setRequestFilter("")}
				/>,
			);
		}
		if (view === "logs" && sessionFilter) {
			activeChips.push(
				<FilterChip
					key="session"
					label="Session"
					value={<code className="font-mono text-[11px]">{shortenIdentifier(sessionFilter, 6)}</code>}
					onClear={() => setSessionFilter("")}
				/>,
			);
		}
		if (view === "logs" && sourceFilter) {
			activeChips.push(
				<FilterChip
					key="source"
					label="Source"
					value={clientSourceOptions.find((source) => source.value === sourceFilter)?.label ?? sourceFilter}
					onValueClick={() => editFilterValue("source")}
					onClear={() => setSourceFilter("")}
				/>,
			);
		}
		for (const tokenFilter of [
			{ key: "input_tokens", label: t("strings.Input Tokens" as never), value: inputTokensFilter, max: inputTokensMax, operator: inputTokensOperator, clear: () => { void setInputTokensFilter(""); void setInputTokensMax(""); } },
			{ key: "output_tokens", label: t("strings.Output Tokens" as never), value: outputTokensFilter, max: outputTokensMax, operator: outputTokensOperator, clear: () => { void setOutputTokensFilter(""); void setOutputTokensMax(""); } },
			{ key: "total_tokens", label: t("strings.Total Tokens" as never), value: totalTokensFilter, max: totalTokensMax, operator: totalTokensOperator, clear: () => { void setTotalTokensFilter(""); void setTotalTokensMax(""); } },
		]) {
			if (!tokenFilter.value) continue;
			activeChips.push(
				<FilterChip
					key={tokenFilter.key}
					filterKey={tokenFilter.key}
					label={tokenFilter.label}
					value={tokenFilter.operator === "between" ? `${tokenFilter.value} and ${tokenFilter.max}` : tokenFilter.value}
					operatorOptions={["gte", "lte", "eq", "between"]}
					defaultOperator="gte"
					onValueClick={() => editFilterValue(tokenFilter.key)}
					onClear={tokenFilter.clear}
				/>,
			);
		}
	}

	if (view === "jobs") {
		if (!lockJobKind && jobKindFilter) {
			activeChips.push(
				<FilterChip
					key="job-kind"
					label="Kind"
					value={jobKindFilter === "video" ? "Video" : "Batch"}
					onValueClick={() => editFilterValue("kind")}
					onClear={() => setJobKindFilter("")}
				/>,
			);
		}
		if (jobStatusFilter) {
			activeChips.push(
				<FilterChip
					key="job-status"
					label="Status"
					value={jobStatusOptions.find((option) => option.value === jobStatusFilter)?.label ?? jobStatusFilter}
					onValueClick={() => editFilterValue("status")}
					onClear={() => setJobStatusFilter("")}
				/>,
			);
		}
		if (jobProviderFilter) {
			activeChips.push(
				<FilterChip
					key="job-provider"
					label="Provider"
					valueLogoId={jobProviderFilter}
					valueOptions={providerOptions}
					activeValue={jobProviderFilter}
					onValueSelect={setJobProviderFilter}
					value={
						providerNames.get(jobProviderFilter) ??
						providerMetadata.get(jobProviderFilter)?.name ??
						jobProviderFilter
					}
					onClear={() => setJobProviderFilter("")}
				/>,
			);
		}
	}

	if (view === "sessions") {
		if (sessionAppFilter) {
			activeChips.push(
				<FilterChip
					key="session-app"
					label="App"
					value={appMetadata.get(sessionAppFilter)?.title?.trim() || sessionAppFilter}
					onValueClick={() => editFilterValue("app")}
					onClear={() => setSessionAppFilter("")}
				/>,
			);
		}
		if (sessionModelFilter) {
			activeChips.push(
				<FilterChip
					key="session-model"
					label="Model"
					value={getModelDisplayName(sessionModelFilter, modelMetadata)}
					valueLogoId={modelMetadata.get(sessionModelFilter)?.organisationId}
					valueOptions={sessionModelOptions}
					activeValue={sessionModelFilter}
					onValueSelect={setSessionModelFilter}
					onClear={() => setSessionModelFilter("")}
				/>,
			);
		}
		if (sessionProviderFilter) {
			activeChips.push(
				<FilterChip
					key="session-provider"
					label="Provider"
					valueLogoId={sessionProviderFilter}
					valueOptions={sessionProviderOptions}
					activeValue={sessionProviderFilter}
					onValueSelect={setSessionProviderFilter}
					value={
						providerNames.get(sessionProviderFilter) ??
						providerMetadata.get(sessionProviderFilter)?.name ??
						sessionProviderFilter
					}
					onClear={() => setSessionProviderFilter("")}
				/>,
			);
		}
		if (sessionFilter) {
			activeChips.push(
				<FilterChip
					key="session"
					label="Session"
					value={<code className="font-mono text-[11px]">{shortenIdentifier(sessionFilter, 6)}</code>}
					onClear={() => setSessionFilter("")}
				/>,
			);
		}
	}

	type FilterPicker = { id: string; label: string; options: FilterOption[]; activeValue: string; onSelect: (value: string) => void | Promise<unknown>; kind?: "numeric"; maxValue?: string; operator?: string; onNumericApply?: (value: string, max: string, operator: string) => void };
	const filterPickers: FilterPicker[] = view === "logs"
		? [
			{ id: "source", label: t("strings.Source" as never), options: clientSourceOptions, activeValue: sourceFilter, onSelect: setSourceFilter },
			{ id: "model", label: t("strings.Model" as never), options: modelOptions, activeValue: modelFilter, onSelect: setModelFilter },
			{ id: "provider", label: t("strings.Provider" as never), options: providerOptions, activeValue: providerFilter, onSelect: setProviderFilter },
			{ id: "app", label: t("strings.App" as never), options: logAppOptions, activeValue: appFilter, onSelect: setAppFilter },
			{ id: "endpoint", label: t("strings.Endpoint" as never), options: endpointOptions, activeValue: endpointFilter, onSelect: setEndpointFilter },
			{ id: "finish", label: t("strings.Finish Reason" as never), options: finishReasonOptions, activeValue: finishReasonFilter, onSelect: setFinishReasonFilter },
			{ id: "stream", label: t("strings.Stream" as never), options: streamOptions, activeValue: streamFilter === "all" ? "" : streamFilter, onSelect: (value) => setStreamFilter(value || "all") },
			{ id: "error", label: t("strings.Error Code" as never), options: errorCodeOptions, activeValue: errorCodeFilter, onSelect: setErrorCodeFilter },
			{ id: "http", label: t("strings.HTTP Status" as never), options: statusCodeOptions, activeValue: statusCodeFilter, onSelect: setStatusCodeFilter },
			{ id: "key", label: t("strings.API Key" as never), options: keyOptions, activeValue: keyFilter, onSelect: setKeyFilter },
			{ id: "status", label: t("strings.Status" as never), options: statusOptions, activeValue: statusFilter === "all" ? "" : statusFilter, onSelect: (value) => setStatusFilter(value || "all") },
			{ id: "input_tokens", label: t("strings.Input Tokens" as never), kind: "numeric", options: [], activeValue: inputTokensFilter, maxValue: inputTokensMax, operator: inputTokensOperator, onSelect: setInputTokensFilter, onNumericApply: (value, max, operator) => { void setInputTokensFilter(value); void setInputTokensMax(max); void setInputTokensOperator(operator); setPickerOpen(false); } },
			{ id: "output_tokens", label: t("strings.Output Tokens" as never), kind: "numeric", options: [], activeValue: outputTokensFilter, maxValue: outputTokensMax, operator: outputTokensOperator, onSelect: setOutputTokensFilter, onNumericApply: (value, max, operator) => { void setOutputTokensFilter(value); void setOutputTokensMax(max); void setOutputTokensOperator(operator); setPickerOpen(false); } },
			{ id: "total_tokens", label: t("strings.Total Tokens" as never), kind: "numeric", options: [], activeValue: totalTokensFilter, maxValue: totalTokensMax, operator: totalTokensOperator, onSelect: setTotalTokensFilter, onNumericApply: (value, max, operator) => { void setTotalTokensFilter(value); void setTotalTokensMax(max); void setTotalTokensOperator(operator); setPickerOpen(false); } },
		]
		: view === "upstream"
			? [
				{ id: "model", label: t("strings.Model" as never), options: modelOptions, activeValue: modelFilter, onSelect: setModelFilter },
				{ id: "provider", label: t("strings.Provider" as never), options: providerOptions, activeValue: providerFilter, onSelect: setProviderFilter },
				{ id: "key", label: t("strings.API Key" as never), options: keyOptions, activeValue: keyFilter, onSelect: setKeyFilter },
				{ id: "status", label: t("strings.Status" as never), options: statusOptions, activeValue: statusFilter === "all" ? "" : statusFilter, onSelect: (value) => setStatusFilter(value || "all") },
			]
			: view === "jobs"
				? [
					...(!lockJobKind ? [{ id: "kind", label: t("strings.Kind" as never), options: jobKindOptions, activeValue: jobKindFilter, onSelect: setJobKindFilter }] : []),
					{ id: "status", label: t("strings.Status" as never), options: jobStatusOptions, activeValue: jobStatusFilter, onSelect: setJobStatusFilter },
					{ id: "provider", label: t("strings.Provider" as never), options: providerOptions, activeValue: jobProviderFilter, onSelect: setJobProviderFilter },
				]
				: [
					{ id: "app", label: t("strings.App" as never), options: sessionAppOptions, activeValue: sessionAppFilter, onSelect: setSessionAppFilter },
					{ id: "model", label: t("strings.Model" as never), options: sessionModelOptions, activeValue: sessionModelFilter, onSelect: setSessionModelFilter },
					{ id: "provider", label: t("strings.Provider" as never), options: sessionProviderOptions, activeValue: sessionProviderFilter, onSelect: setSessionProviderFilter },
				];
	const selectedPicker = filterPickers.find((picker) => picker.id === selectedFilterType) ?? null;
	const SelectedFilterIcon = selectedPicker ? (FILTER_ICONS[selectedPicker.id] ?? ListFilter) : null;
	const selectedOptionGroups = selectedPicker
		? Array.from(new Set(selectedPicker.options.map((option) => option.group ?? "")))
		: [];
	const pickerRowCount = selectedPicker?.options.length ?? filterPickers.length;
	const pickerListHeight = Math.min(320, Math.max(48, pickerRowCount * 32 + Math.max(1, selectedOptionGroups.length) * 28));
	const clearAll = () => {
		for (const picker of filterPickers) void picker.onSelect("");
		if (view === "logs" || view === "sessions") void setSessionFilter("");
		if (view === "logs") void setRequestFilter("");
	};

	return (
		<div className="flex min-w-0 items-center">
			<Popover open={pickerOpen} onOpenChange={(open) => {
				if (!open && pickerViewportRef.current) pickerScrollPositions.current.set(selectedFilterType ?? "root", pickerViewportRef.current.scrollTop);
				setPickerOpen(open);
				if (!open) setSelectedFilterType(null);
			}}>
				<PopoverTrigger asChild>
					<Button type="button" variant="outline" className="h-9 gap-2 rounded-md px-3 text-xs font-medium">
						<ListFilter className="size-3.5" />
						{t("strings.Add Filter" as never)}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-[320px] gap-0 overflow-hidden rounded-md! p-0">
					<Command className="rounded-md!">
						{selectedPicker?.kind !== "numeric" ? <CommandInput placeholder={selectedPicker ? `${t("strings.Search" as never)} ${selectedPicker.label.toLowerCase()}…` : t("strings.Search filters…" as never)} /> : null}
						{selectedPicker ? (
							<button type="button" onClick={() => changeSelectedFilterType(null)} className="mt-1 flex h-10 w-full shrink-0 items-center gap-2 rounded-md border-b border-border/70 px-3 text-left text-xs font-medium hover:bg-muted/60">
								<ArrowLeft className="size-3.5" />
								{SelectedFilterIcon ? <SelectedFilterIcon className="size-3.5 text-muted-foreground" /> : null}
								{selectedPicker.label}
							</button>
						) : null}
						<CommandList className="max-h-none overflow-hidden">
							{selectedPicker?.kind === "numeric" && selectedPicker.onNumericApply ? (
								<NumericFilterEditor label={selectedPicker.label} initialValue={selectedPicker.activeValue} initialMax={selectedPicker.maxValue ?? ""} initialOperator={selectedPicker.operator ?? "gte"} onApply={selectedPicker.onNumericApply} />
							) : <ScrollArea style={{ height: pickerListHeight }} viewportRef={pickerViewportRef} viewportClassName="pr-2">
								<CommandEmpty>No matching {selectedPicker ? "options" : "filters"}.</CommandEmpty>
								{selectedPicker ? (
									(selectedOptionGroups.length ? selectedOptionGroups : [""]).map((group) => (
										<CommandGroup key={group || "options"} heading={group || undefined}>
											{selectedPicker.options.filter((option) => (option.group ?? "") === group).map((option) => (
												<CommandItem className="rounded-md" key={option.value} value={`${option.label} ${option.value}`} data-checked={selectedPicker.activeValue === option.value} onSelect={() => { void selectedPicker.onSelect(option.value); setPickerOpen(false); }}>
													{option.logoId ? <Logo id={option.logoId} width={14} height={14} className="shrink-0 rounded-sm" /> : null}
													<span className="min-w-0 flex-1 truncate">{option.label}</span>
												</CommandItem>
											))}
										</CommandGroup>
									))
								) : <CommandGroup heading="Filters">{filterPickers.map((picker) => {
									const FilterIcon = FILTER_ICONS[picker.id] ?? ListFilter;
									return <CommandItem className="rounded-md" key={picker.id} value={picker.label} onSelect={() => changeSelectedFilterType(picker.id)}>
										<FilterIcon />
										<span className="flex-1">{picker.label}</span>
										{picker.activeValue ? <Check className="size-3.5 opacity-100" /> : null}
									</CommandItem>;
								})}</CommandGroup>}
							</ScrollArea>}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{filterBarTarget && (activeChips.length > 0 || filtersPending)
				? createPortal(
						<div className="flex w-full flex-wrap items-center gap-2 rounded-sm border border-border/70 bg-muted/15 p-2">
							{activeChips}
							{filtersPending ? (
								<span className="ml-auto inline-flex h-7 items-center gap-2 px-2 text-xs text-muted-foreground" role="status" aria-live="polite">
									<Loader2 className="size-3.5 animate-spin" />
									{t("strings.Updating requests…" as never)}
								</span>
							) : activeChips.length > 0 ? (
								<>
									<button type="button" className="ml-auto px-2 text-xs text-muted-foreground hover:text-foreground" onClick={clearAll}>{t("strings.Clear" as never)}</button>
									<button type="button" className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setPickerOpen(true)} aria-label={t("strings.Add another filter" as never)}><Plus className="size-3.5" /></button>
								</>
							) : null}
						</div>,
						filterBarTarget,
					)
				: null}
		</div>
	);
}
