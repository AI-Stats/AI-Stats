"use client";

import * as React from "react";
import { Check, CircleAlert, Clock3, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { promoteProviderRouteCandidateAction, recordProviderRouteProbeAction, reviewProviderCatalogModelAction } from "@/app/(dashboard)/settings/internal/provider-review/actions";
import type { InternalProviderCatalogReview } from "@/lib/fetchers/internal/fetchInternalProviderCatalogReviews";

type Props = { initialReviews: InternalProviderCatalogReview[] };

function statusTone(status: string): string {
	if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
	if (status === "rejected" || status === "needs_changes") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300";
	return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
}

export default function ProviderReviewClient({ initialReviews }: Props) {
	const [reviews, setReviews] = React.useState(initialReviews);
	const [reasons, setReasons] = React.useState<Record<string, string>>({});
	const [saving, setSaving] = React.useState<string | null>(null);

	async function decide(runId: string, modelSlug: string, decision: "approved" | "rejected" | "needs_changes") {
		const key = `${runId}:${modelSlug}`;
		const reason = reasons[key]?.trim();
		if (decision !== "approved" && !reason) {
			toast.error("Add a reason before requesting changes or rejecting a model.");
			return;
		}
		setSaving(key);
		try {
			const result = await reviewProviderCatalogModelAction({ runId, modelSlug, decision, reason });
			setReviews((current) => current.map((review) => review.id !== runId ? review : {
				...review,
				review_status: result.reviewStatus,
				review_summary: result.reviewSummary,
				models: review.models.map((model) => model.model_slug !== modelSlug ? model : { ...model, decision, decision_reason: decision === "approved" ? null : reason ?? null, reviewed_at: new Date().toISOString() }),
			}));
			toast.success(decision === "approved" ? "Model claim approved" : decision === "needs_changes" ? "Changes requested" : "Model claim rejected");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save review decision");
		} finally { setSaving(null); }
	}

	async function probe(runId: string, modelSlug: string, passed: boolean) {
		const key = `${runId}:${modelSlug}`; const reason = reasons[key]?.trim();
		if (!passed && !reason) return toast.error("Add the probe failure reason first.");
		setSaving(key);
		try { const result = await recordProviderRouteProbeAction({ runId, modelSlug, passed, reason }); setReviews((current) => current.map((review) => review.id !== runId ? review : { ...review, models: review.models.map((model) => model.model_slug !== modelSlug ? model : { ...model, candidate: model.candidate ? { ...model.candidate, status: result.candidate.status as NonNullable<typeof model.candidate>["status"], probed_at: result.candidate.probed_at } : null }) })); toast.success(passed ? "Probe marked as passed" : "Probe failure recorded"); }
		catch (error) { toast.error(error instanceof Error ? error.message : "Could not record probe result"); }
		finally { setSaving(null); }
	}

	async function promote(runId: string, modelSlug: string) {
		const key = `${runId}:${modelSlug}`; setSaving(key);
		try { await promoteProviderRouteCandidateAction({ runId, modelSlug }); setReviews((current) => current.map((review) => review.id !== runId ? review : { ...review, models: review.models.map((model) => model.model_slug !== modelSlug ? model : { ...model, candidate: model.candidate ? { ...model.candidate, status: "promoted", promoted_at: new Date().toISOString() } : null }) })); toast.success("Provider route promoted"); }
		catch (error) { toast.error(error instanceof Error ? error.message : "Could not promote route"); }
		finally { setSaving(null); }
	}

	return <div className="space-y-5">
		<div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4"><Clock3 className="mt-0.5 size-4 text-muted-foreground" /><p className="text-sm leading-6 text-muted-foreground">Approving a claim creates an immutable route candidate. Production routes are not changed until that candidate passes endpoint probes and is promoted.</p></div>
		{reviews.length ? reviews.map((review) => <Card key={review.id} className="border-border/70"><CardHeader className="border-b border-border/60"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{review.provider?.name ?? review.provider_slug}</CardTitle><CardDescription className="mt-1">{review.provider_slug} · {review.model_count ?? review.models.length} models · {review.trigger} sync</CardDescription></div><span className={cn("inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize", statusTone(review.review_status))}>{review.review_status.replaceAll("_", " ")}</span></div></CardHeader><CardContent className="divide-y divide-border/60 p-0">{review.models.map((model) => { const key = `${review.id}:${model.model_slug}`; const pending = model.decision === "pending"; return <div key={model.model_slug} className="space-y-3 px-5 py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{model.name}</p><span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", statusTone(model.decision))}>{model.decision.replaceAll("_", " ")}</span>{model.candidate ? <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", statusTone(model.candidate.status === "promoted" || model.candidate.status === "probe_passed" ? "approved" : model.candidate.status === "probe_failed" ? "rejected" : "pending"))}>{model.candidate.status.replaceAll("_", " ")}</span> : null}</div><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{model.model_slug} → {model.provider_model_slug}</p><div className="mt-2 flex flex-wrap gap-1.5">{model.capabilities.map((capability) => <span key={capability.id} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{capability.id}</span>)}</div>{model.decision_reason ? <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{model.decision_reason}</p> : null}</div>{pending ? <div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" onClick={() => void decide(review.id, model.model_slug, "approved")} disabled={saving === key}><Check className="mr-1.5 size-3.5" /> Approve</Button><Button size="sm" variant="outline" onClick={() => void decide(review.id, model.model_slug, "needs_changes")} disabled={saving === key}><CircleAlert className="mr-1.5 size-3.5" /> Request changes</Button><Button size="sm" variant="outline" onClick={() => void decide(review.id, model.model_slug, "rejected")} disabled={saving === key}><X className="mr-1.5 size-3.5" /> Reject</Button></div> : model.candidate && model.candidate.status !== "promoted" ? <div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void probe(review.id, model.model_slug, true)} disabled={saving === key}>Probe passed</Button><Button size="sm" variant="outline" onClick={() => void probe(review.id, model.model_slug, false)} disabled={saving === key}>Probe failed</Button>{model.candidate.status === "probe_passed" ? <Button size="sm" onClick={() => void promote(review.id, model.model_slug)} disabled={saving === key}>Promote</Button> : null}</div> : <CircleAlert className="size-4 shrink-0 text-muted-foreground" />}</div>{pending || model.candidate?.status === "pending_probe" || model.candidate?.status === "probe_failed" ? <Input value={reasons[key] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))} placeholder={pending ? "Reason required when requesting changes or rejecting" : "Probe evidence or failure reason"} className="max-w-xl text-xs" /> : null}</div>; })}</CardContent></Card>) : <div className="rounded-xl border border-dashed border-border/80 px-6 py-12 text-center"><p className="font-medium">Nothing needs review</p><p className="mt-1 text-sm text-muted-foreground">New provider catalog revisions will appear here after validation.</p></div>}
	</div>;
}
