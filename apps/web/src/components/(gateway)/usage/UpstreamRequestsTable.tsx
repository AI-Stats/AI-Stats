"use client";

import * as React from "react";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";

import type { ProviderMetadataEntry } from "@/app/(dashboard)/gateway/usage/server-actions";

import { Logo } from "@/components/Logo";
import {
	ProviderInspectorSheet,
	ProviderInspectorSheetContent,
	ProviderInspectorSheetDescription,
	ProviderInspectorSheetHeader,
	ProviderInspectorSheetTitle,
} from "@/components/(data)/model/pricing/ProviderInspectorSheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { UsageUpstreamRequestRow } from "@/lib/fetchers/internal/settingsTypes";
import { formatWordyDateTime } from "@/lib/gateway/usage/timeFormatting";
import {
	PROVIDER_PROMPT_TRAINING_POLICY_LABELS,
	normalizeProviderPromptTrainingPolicy,
} from "@/lib/providers/promptTrainingPolicy";
import { cn } from "@/lib/utils";
import { extractUsageMeters } from "./usageMeters";
import { getModelDisplayName, type ModelMetadataMap } from "./model-display";
import UsageEntityHoverCard from "./UsageEntityHoverCard";

type KeyMetadata = { id: string; name: string | null; prefix: string | null };

function getModelDetailsHref(modelId: string): string | null {
	const [organisationId, ...modelParts] = modelId.split("/");
	if (!organisationId || modelParts.length === 0) return null;
	return `/models/${encodeURIComponent(organisationId)}/${encodeURIComponent(modelParts.join("/"))}`;
}

function maskedKeyPrefix(prefix: string | null | undefined): string {
	const value = prefix?.trim();
	return value ? `${value}••••••••` : "Key value hidden";
}

function formatMilliseconds(value: number | null): string {
	return typeof value === "number" && Number.isFinite(value)
		? `${Math.round(value).toLocaleString()} ms`
		: "—";
}

function metadataNumber(value: unknown, key: string): number | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const raw = (value as Record<string, unknown>)[key];
	const parsed = typeof raw === "number" ? raw : Number(raw);
	return Number.isFinite(parsed) ? parsed : null;
}

function throughputForRow(row: UsageUpstreamRequestRow): number | null {
	const supplied = metadataNumber(row.metadata, "throughput");
	if (supplied !== null) return supplied;
	const outputTokens = extractUsageMeters(row.usage)
		.filter((meter) => meter.key === "output_tokens" || meter.key === "completion_tokens")
		.reduce((sum, meter) => sum + meter.value, 0);
	const generationMs = row.generation_ms ?? row.duration_ms;
	return outputTokens > 0 && generationMs && generationMs > 0
		? outputTokens / (generationMs / 1_000)
		: null;
}

function formatThroughput(row: UsageUpstreamRequestRow): string {
	const value = throughputForRow(row);
	return value === null ? "—" : `${value.toFixed(value >= 100 ? 0 : 1)} tok/s`;
}

function attemptLabel(row: UsageUpstreamRequestRow): string {
	const attempt = row.attempt_number ?? row.internal_attempt_number ?? row.sequence;
	return row.attempt_count && row.attempt_count > 1
		? `${attempt} of ${row.attempt_count}`
		: String(attempt);
}

function keySourceLabel(value: UsageUpstreamRequestRow["key_source"]): string {
	if (value === "byok") return "BYOK";
	if (value === "gateway") return "Phaseo";
	return "—";
}

function jsonText(value: unknown): string {
	if (value == null) return "No data captured.";
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="min-w-0 border-b border-border/60 py-3 last:border-b-0">
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="mt-1 min-w-0 break-words text-sm font-medium text-foreground">{value}</div>
		</div>
	);
}

function PayloadSection({ title, value }: { title: string; value: unknown }) {
	return (
		<section className="space-y-2">
			<h3 className="text-sm font-semibold">{title}</h3>
			<pre className="max-h-80 overflow-auto rounded-lg border border-border/70 bg-muted/25 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
				{jsonText(value)}
			</pre>
		</section>
	);
}

export default function UpstreamRequestsTable({
	rows,
	modelMetadata,
	providerNames,
	providerMetadata,
	keys,
}: {
	rows: UsageUpstreamRequestRow[];
	modelMetadata: ModelMetadataMap;
	providerNames: Map<string, string>;
	providerMetadata: Map<string, ProviderMetadataEntry>;
	keys: Map<string, KeyMetadata>;
}) {
	const [selected, setSelected] = React.useState<UsageUpstreamRequestRow | null>(null);

	return (
		<>
			<div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border/70">
				<div className="w-full overflow-x-auto">
					<Table wrapInContainer={false} className="min-w-[1080px] whitespace-nowrap text-xs">
						<TableHeader>
							<TableRow className="h-9">
								<TableHead>Date</TableHead>
								<TableHead>Model</TableHead>
								<TableHead>Provider</TableHead>
								<TableHead>Generation ID</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Attempts</TableHead>
								<TableHead>Key used</TableHead>
								<TableHead className="text-right">Throughput</TableHead>
								<TableHead className="text-right">Latency</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.length === 0 ? (
								<TableRow>
									<TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
										No upstream requests in this period.
									</TableCell>
								</TableRow>
							) : rows.map((row) => {
								const modelLabel = getModelDisplayName(row.model_id, modelMetadata);
								const model = modelMetadata.get(row.model_id);
								const provider = row.provider ? providerMetadata.get(row.provider) : null;
								const providerPolicy = provider
									? PROVIDER_PROMPT_TRAINING_POLICY_LABELS[
										normalizeProviderPromptTrainingPolicy(provider.promptTrainingPolicy)
									]
									: null;
								const key = row.key_id ? keys.get(row.key_id) : null;
								const keyLabel = key?.name?.trim() || keySourceLabel(row.key_source);
								const providerLabel = row.provider ? providerNames.get(row.provider) ?? row.provider : "—";
								return (
									<TableRow
										key={`${row.id}-${row.created_at}`}
										role="button"
										tabIndex={0}
										className="cursor-pointer"
										onClick={() => setSelected(row)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												setSelected(row);
											}
										}}
									>
										<TableCell className="font-mono">{formatWordyDateTime(row.created_at, { includeTime: true })}</TableCell>
									<TableCell>
										<UsageEntityHoverCard
											title={modelLabel}
											subtitle={model?.organisationName}
											href={getModelDetailsHref(row.model_id)}
											visual={model?.organisationId ? <Logo id={model.organisationId} width={18} height={18} /> : null}
											rows={[{ label: "Model ID", value: <code className="font-mono text-[11px]">{row.model_id}</code> }]}
										>
											<span className="flex max-w-[230px] items-center gap-2">
												{model?.organisationId ? <Logo id={model.organisationId} width={15} height={15} /> : null}
												<span className="truncate" title={modelLabel}>{modelLabel}</span>
											</span>
										</UsageEntityHoverCard>
									</TableCell>
									<TableCell>
										{row.provider ? (
											<UsageEntityHoverCard
												title={providerLabel}
												subtitle={providerPolicy}
												href={`/api-providers/${encodeURIComponent(row.provider)}`}
												visual={<Logo id={row.provider} width={18} height={18} />}
												rows={[]}
											>
												<span className="inline-flex items-center gap-2">
													<Logo id={row.provider} width={15} height={15} />
													{providerLabel}
												</span>
											</UsageEntityHoverCard>
										) : providerLabel}
									</TableCell>
										<TableCell className="max-w-[210px] truncate font-mono" title={row.request_id}>{row.request_id}</TableCell>
										<TableCell>
											<Badge variant="outline" className={cn("gap-1", row.success ? "border-emerald-500/30 text-emerald-600" : "border-rose-500/30 text-rose-600")}>
												{row.success ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
												{row.status_code ?? row.outcome}
											</Badge>
										</TableCell>
									<TableCell className="text-right font-mono">{attemptLabel(row)}</TableCell>
									<TableCell>
										<UsageEntityHoverCard
											title={keyLabel}
											subtitle={key ? maskedKeyPrefix(key.prefix) : row.key_source === "byok" ? "Bring your own key" : "Phaseo-managed provider key"}
											href={key ? "/settings/keys" : null}
											visual={<KeyRound className="size-4 text-muted-foreground" />}
											rows={key ? [{ label: "Source", value: keySourceLabel(row.key_source) }] : []}
										>
											<span className="inline-flex items-center gap-1.5"><KeyRound className="size-3.5 text-muted-foreground" />{keyLabel}</span>
										</UsageEntityHoverCard>
									</TableCell>
										<TableCell className="text-right font-mono">{formatThroughput(row)}</TableCell>
										<TableCell className="text-right font-mono">{formatMilliseconds(row.latency_ms ?? row.duration_ms)}</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</div>

			<ProviderInspectorSheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
				<ProviderInspectorSheetContent className="!w-full max-w-none gap-0 overflow-hidden p-0 sm:max-w-none md:!w-[58vw] lg:!w-[52vw] xl:!w-[48vw] 2xl:!w-[44vw] data-[side=right]:sm:max-w-none">
					{selected ? (
						<>
							<ProviderInspectorSheetHeader className="border-b border-border/70 px-5 py-4 pr-14">
								<ProviderInspectorSheetTitle className="flex items-center gap-2">
									{selected.provider ? <Logo id={selected.provider} width={18} height={18} /> : null}
									{selected.provider ? providerNames.get(selected.provider) ?? selected.provider : "Upstream request"}
								</ProviderInspectorSheetTitle>
								<ProviderInspectorSheetDescription className="font-mono text-xs">{selected.request_id}</ProviderInspectorSheetDescription>
							</ProviderInspectorSheetHeader>
							<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
								<div className="grid grid-cols-2 gap-x-5">
									<DetailField label="Model" value={getModelDisplayName(selected.model_id, modelMetadata)} />
									<DetailField label="Provider model" value={selected.provider_model_slug ?? selected.api_model_id ?? "—"} />
									<DetailField label="Status" value={selected.status_code ?? selected.outcome} />
									<DetailField label="Attempt" value={attemptLabel(selected)} />
									<DetailField label="Key used" value={keySourceLabel(selected.key_source)} />
									<DetailField label="Throughput" value={formatThroughput(selected)} />
									<DetailField label="Latency" value={formatMilliseconds(selected.latency_ms ?? selected.duration_ms)} />
									<DetailField label="Total time" value={formatMilliseconds(selected.total_ms)} />
									<DetailField label="Outcome" value={selected.outcome} />
									<DetailField label="Finish reason" value={selected.provider_finish_reason ?? selected.finish_reason ?? "—"} />
								</div>
								{selected.error_message ? (
									<div className="my-4 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-sm text-rose-600">
										<div className="font-medium">{selected.error_code ?? selected.error_type ?? "Upstream error"}</div>
										<div className="mt-1">{selected.error_message}</div>
									</div>
								) : null}
								<Separator className="my-5" />
								<div className="space-y-5">
									<PayloadSection title="Request payload" value={selected.request_payload} />
									<PayloadSection title="Response payload" value={selected.response_payload} />
									<PayloadSection title="Usage" value={selected.usage} />
									<PayloadSection title="Metadata" value={selected.metadata} />
								</div>
							</div>
						</>
					) : null}
				</ProviderInspectorSheetContent>
			</ProviderInspectorSheet>
		</>
	);
}
