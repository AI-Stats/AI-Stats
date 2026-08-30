"use client";

import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import {
	ArrowDown,
	ArrowUp,
	Check,
	ChevronsUpDown,
	DollarSign,
	Gauge,
	Layers3,
	Loader2,
	Route,
	ShieldCheck,
	Sparkles,
	Trash2,
	Zap,
} from "lucide-react";
import { toast } from "sonner";
import { updateAutoRoutingSettings } from "@/app/(dashboard)/settings/routing/actions";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { GatewaySupportedModel } from "@/lib/fetchers/gateway/getGatewaySupportedModelIds";
import type {
	AutoRoutingObjective,
	SettingsAutoRoutingInitialData,
} from "@/lib/fetchers/internal/settingsTypes";
import { publicSWRKeys } from "@/lib/swr/keys";
import { publicSWRFetcher } from "@/lib/swr/publicFetcher";
import { cn } from "@/lib/utils";

type ModelOption = {
	id: string;
	label: string;
	organisationId: string;
	organisationName: string;
	providerNames: string[];
	releaseDate: string | null;
};

const TEXT_CAPABILITIES = new Set(["responses", "chat/completions", "chat.completions", "messages", "text.generate"]);

const OBJECTIVES: Array<{
	value: AutoRoutingObjective;
	label: string;
	description: string;
	icon: typeof Sparkles;
}> = [
	{ value: "balanced", label: "Balanced", description: "Quality first, with practical cost and reliability tradeoffs.", icon: Layers3 },
	{ value: "quality", label: "Quality", description: "Prefer the strongest benchmark fit for each workload.", icon: Sparkles },
	{ value: "cost", label: "Cost", description: "Weight listed token price most heavily.", icon: DollarSign },
	{ value: "latency", label: "Latency", description: "Prefer models with faster recent response times.", icon: Zap },
];

function fallbackModelLabel(modelId: string): string {
	const leaf = modelId.split("/").pop() ?? modelId;
	return leaf.split(/[-_]/g).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function buildModelOptions(models: GatewaySupportedModel[]): ModelOption[] {
	const byId = new Map<string, ModelOption>();
	for (const model of models) {
		if (!model.isAvailable || !model.capabilities.some((capability) => TEXT_CAPABILITIES.has(capability))) continue;
		const id = model.selectorModelId || model.modelId;
		if (!id || id === "phaseo/auto" || id.startsWith("@")) continue;
		const organisationId = model.organisationId?.trim() || id.split("/")[0] || "phaseo";
		const providerName = model.providerName ?? model.providerId;
		const existing = byId.get(id);
		if (existing) {
			if (!existing.providerNames.includes(providerName)) existing.providerNames.push(providerName);
			continue;
		}
		byId.set(id, {
			id,
			label: model.modelName?.trim() || fallbackModelLabel(id),
			organisationId,
			organisationName: model.organisationName ?? organisationId.replaceAll("-", " "),
			providerNames: [providerName],
			releaseDate: model.releaseDate ?? model.announcementDate ?? null,
		});
	}
	return [...byId.values()].sort((left, right) => {
		const leftTime = left.releaseDate ? Date.parse(left.releaseDate) : Number.NEGATIVE_INFINITY;
		const rightTime = right.releaseDate ? Date.parse(right.releaseDate) : Number.NEGATIVE_INFINITY;
		return rightTime - leftTime || left.label.localeCompare(right.label);
	});
}

function configurationFingerprint(value: {
	enabled: boolean;
	allowedModels: string[];
	objective: AutoRoutingObjective;
	allowFallbacks: boolean;
}) {
	return JSON.stringify([
		value.enabled,
		value.allowedModels,
		value.objective,
		value.allowFallbacks,
	]);
}

function ModelPicker({
	disabled,
	modelOptions,
	onAdd,
	selectedModels,
}: {
	disabled: boolean;
	modelOptions: ModelOption[];
	onAdd: (modelId: string) => void;
	selectedModels: string[];
}) {
	const [open, setOpen] = useState(false);
	const available = modelOptions.filter((model) => !selectedModels.includes(model.id));
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" disabled={disabled} className="w-full justify-between border-dashed">
					<span className="flex items-center gap-2"><Sparkles className="size-4" />Add model</span>
					<ChevronsUpDown className="size-4 text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[min(520px,calc(100vw-2rem))] p-0">
				<Command>
					<CommandInput placeholder="Search text-generation models…" />
					<CommandList className="max-h-96 p-1">
						<CommandEmpty>No compatible models found.</CommandEmpty>
						{available.map((model) => (
							<CommandItem
								key={model.id}
								value={`${model.label} ${model.id} ${model.organisationName} ${model.providerNames.join(" ")}`}
								onSelect={() => {
									onAdd(model.id);
									setOpen(false);
								}}
								className="min-h-12 gap-3 py-2"
							>
								<Logo id={model.organisationId} alt={model.organisationName} width={20} height={20} className="size-5 shrink-0 object-contain" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{model.organisationName}: {model.label}</p>
									<p className="truncate text-[11px] text-muted-foreground">{model.id} · {model.providerNames.join(", ")}</p>
								</div>
								<Check className="size-4 opacity-0" />
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export default function AutoRoutingSettingsClient({ initialData }: { initialData: SettingsAutoRoutingInitialData }) {
	const initial = initialData.autoRouting;
	const [enabled, setEnabled] = useState(initial.enabled);
	const [allowedModels, setAllowedModels] = useState(initial.allowedModels);
	const [objective, setObjective] = useState<AutoRoutingObjective>(initial.objective);
	const [allowFallbacks, setAllowFallbacks] = useState(initial.allowFallbacks);
	const [savedFingerprint, setSavedFingerprint] = useState(configurationFingerprint(initial));
	const [revision, setRevision] = useState(initial.revision);
	const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
	const [isPending, startTransition] = useTransition();
	const { data: modelCatalog, error: modelCatalogError, isLoading: modelCatalogLoading } = useSWR<{ models: GatewaySupportedModel[] }>(publicSWRKeys.gatewayModels, publicSWRFetcher);
	const modelOptions = useMemo(() => buildModelOptions(modelCatalog?.models ?? []), [modelCatalog?.models]);
	const optionsById = useMemo(() => new Map(modelOptions.map((model) => [model.id, model])), [modelOptions]);
	const current = { enabled, allowedModels, objective, allowFallbacks };
	const dirty = configurationFingerprint(current) !== savedFingerprint;
	const valid = !enabled || allowedModels.length >= 2;
	const canEdit = initialData.canManage && !isPending;

	function moveModel(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= allowedModels.length) return;
		setAllowedModels((models) => {
			const next = [...models];
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});
	}

	function save() {
		if (!valid) {
			toast.error("Choose at least two models before enabling Auto Routing.");
			return;
		}
		startTransition(async () => {
			const result = await updateAutoRoutingSettings(current);
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			const saved = result.autoRouting;
			setEnabled(saved.enabled);
			setAllowedModels(saved.allowedModels);
			setObjective(saved.objective);
			setAllowFallbacks(saved.allowFallbacks);
			setRevision(saved.revision);
			setUpdatedAt(saved.updatedAt);
			setSavedFingerprint(configurationFingerprint(saved));
			toast.success(result.gatewayCacheInvalidated ? "Auto Routing updated" : "Auto Routing updated; gateway cache refresh pending");
		});
	}

	return (
		<div className="space-y-6">
			<section className="overflow-hidden rounded-xl border bg-card">
				<div className="flex flex-col gap-5 border-b bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<div className="grid size-10 shrink-0 place-items-center rounded-lg border bg-background shadow-sm"><Route className="size-5" /></div>
						<div>
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="font-semibold">Workspace auto-router</h2>
								<Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
							</div>
							<p className="mt-1 text-sm text-muted-foreground">Requests using <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">phaseo/auto</code> stay inside this model pool.</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-sm font-medium">Accept auto-routed requests</span>
						<Switch checked={enabled} disabled={!canEdit} onCheckedChange={setEnabled} aria-label="Enable Auto Routing" />
					</div>
				</div>
				<div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
					<div className="space-y-5 border-b p-5 lg:border-b-0 lg:border-r">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h3 className="text-sm font-semibold">Model pool</h3>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">Two to eight models. Order is used only to break an exact scoring tie.</p>
							</div>
							<Badge variant="outline">{allowedModels.length}/8</Badge>
						</div>

						<div className="space-y-2">
							{allowedModels.length ? allowedModels.map((modelId, index) => {
								const model = optionsById.get(modelId);
								const organisationId = model?.organisationId ?? modelId.split("/")[0] ?? "phaseo";
								return (
									<div key={modelId} className="group flex items-center gap-3 rounded-lg border bg-background p-3 shadow-xs">
										<span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground">{index + 1}</span>
										<Logo id={organisationId} alt={model?.organisationName ?? organisationId} width={20} height={20} className="size-5 shrink-0 object-contain" />
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">{model?.label ?? fallbackModelLabel(modelId)}</p>
											<p className="truncate font-mono text-[11px] text-muted-foreground">{modelId}</p>
										</div>
										<div className="flex items-center gap-0.5">
											<Button size="icon-sm" variant="ghost" disabled={!canEdit || index === 0} onClick={() => moveModel(index, -1)} aria-label={`Move ${modelId} up`}><ArrowUp className="size-3.5" /></Button>
											<Button size="icon-sm" variant="ghost" disabled={!canEdit || index === allowedModels.length - 1} onClick={() => moveModel(index, 1)} aria-label={`Move ${modelId} down`}><ArrowDown className="size-3.5" /></Button>
											<Button size="icon-sm" variant="ghost" disabled={!canEdit} onClick={() => setAllowedModels((models) => models.filter((id) => id !== modelId))} aria-label={`Remove ${modelId}`}><Trash2 className="size-3.5" /></Button>
										</div>
									</div>
								);
							}) : (
								<div className="grid min-h-32 place-items-center rounded-lg border border-dashed bg-muted/10 p-6 text-center">
									<div><Sparkles className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No models selected</p><p className="mt-1 text-xs text-muted-foreground">Add at least two text-generation models.</p></div>
								</div>
							)}
						</div>

						<ModelPicker disabled={!canEdit || allowedModels.length >= 8 || modelCatalogLoading || Boolean(modelCatalogError)} modelOptions={modelOptions} selectedModels={allowedModels} onAdd={(modelId) => setAllowedModels((models) => [...models, modelId])} />
						{modelCatalogLoading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Loading the gateway model catalogue…</p> : null}
						{modelCatalogError ? <p className="text-xs text-destructive">The model catalogue could not be loaded. Existing selections are preserved.</p> : null}
						{enabled && !valid ? <p className="text-xs font-medium text-destructive">Select at least two models before saving.</p> : null}
					</div>

					<div className="space-y-6 p-5">
						<div>
							<h3 className="text-sm font-semibold">Optimize for</h3>
							<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
								{OBJECTIVES.map((option) => {
									const Icon = option.icon;
									const selected = objective === option.value;
									return (
										<button
											key={option.value}
											type="button"
											disabled={!canEdit}
											onClick={() => setObjective(option.value)}
											className={cn("rounded-lg border p-3 text-left transition-colors", selected ? "border-foreground/30 bg-foreground/[0.04]" : "hover:bg-muted/30", !canEdit && "cursor-not-allowed opacity-60")}
										>
											<div className="flex items-center gap-2"><Icon className="size-4" /><span className="text-sm font-semibold">{option.label}</span>{selected ? <Check className="ml-auto size-3.5" /> : null}</div>
											<p className="mt-2 text-[11px] leading-4 text-muted-foreground">{option.description}</p>
										</button>
									);
								})}
							</div>
						</div>

						<div className="flex items-start justify-between gap-4 rounded-lg border p-4">
							<div className="flex gap-3"><Gauge className="mt-0.5 size-4 shrink-0" /><div><p className="text-sm font-medium">Model fallbacks</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Retry the remaining ranked models after rate limits or retryable provider failures.</p></div></div>
							<Switch checked={allowFallbacks} disabled={!canEdit} onCheckedChange={setAllowFallbacks} aria-label="Enable model fallbacks" />
						</div>

						<div className="rounded-lg border bg-zinc-950 p-4 text-zinc-100">
							<div className="flex items-center gap-2 text-xs font-medium text-zinc-300"><ShieldCheck className="size-3.5" />Request contract</div>
							<pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-5 text-zinc-300"><code>{`{\n  "model": "phaseo/auto",\n  "input": "Your prompt"\n}`}</code></pre>
						</div>
					</div>
				</div>
			</section>

			<div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="text-xs text-muted-foreground">
					{revision ? <>Revision <span className="font-mono text-foreground">{revision.slice(0, 8)}</span></> : "Not configured yet"}
					{updatedAt ? <> · Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(updatedAt))}</> : null}
					{!initialData.canManage ? <> · Only workspace owners and admins can make changes.</> : null}
				</div>
				<Button onClick={save} disabled={!initialData.canManage || !dirty || !valid || isPending}>
					{isPending ? <Loader2 className="size-4 animate-spin" /> : null}
					Save configuration
				</Button>
			</div>
		</div>
	);
}
