import type { Metadata } from "next";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { redirect } from "next/navigation";

import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AsyncJobsPanel from "@/components/(gateway)/usage/AsyncJobsPanel";
import SessionsPanel from "@/components/(gateway)/usage/SessionsPanel";
import UsageLogsToolbar from "@/components/(gateway)/usage/UsageLogsToolbar";
import UsageViewFilters from "@/components/(gateway)/usage/UsageViewFilters";
import UpstreamRequestsTable from "@/components/(gateway)/usage/UpstreamRequestsTable";
import {
	getUsageRangeParamKeys,
	parseUsageDateInput,
	parseUsageRangePreset,
	resolveUsageTimeRange,
	type UsageLogsViewKey,
} from "@/lib/gateway/usage/timeRange";

import RequestsSection from "@/components/(gateway)/usage/RequestsSection";
import RouteRequestDetailDialog from "@/components/(gateway)/usage/RouteRequestDetailDialog";
import { investigateGeneration } from "@/app/(dashboard)/gateway/usage/server-actions";
import { fetchSettingsUsageLogsInitialData } from "@/lib/fetchers/internal/fetchSettingsUsageLogsInitialData";

export const metadata: Metadata = {
	title: "Logs - Settings",
};

function parseView(view?: string | null): UsageLogsViewKey {
	const v = (view ?? "").toLowerCase();
	return v === "logs" || v === "upstream" || v === "jobs" || v === "sessions" ? v : "logs";
}

function buildLogsRequestHref(
	searchParams: Record<string, string | string[] | undefined>,
	requestId?: string | null,
): string {
	const next = new URLSearchParams();
	for (const [key, rawValue] of Object.entries(searchParams)) {
		if (typeof rawValue === "string") {
			next.set(key, rawValue);
			continue;
		}
		if (Array.isArray(rawValue)) {
			for (const item of rawValue) {
				if (typeof item === "string") next.append(key, item);
			}
		}
	}
	const query = next.toString();
	const base = requestId
		? `/settings/usage/logs/${encodeURIComponent(requestId)}`
		: "/settings/usage/logs";
	return query ? `${base}?${query}` : base;
}

function firstSearchParam(
	value: string | string[] | undefined,
): string | undefined {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value[0];
	return undefined;
}

function parsePositivePage(value: string | undefined): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default function Page(props: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	return (
		<Suspense fallback={<SettingsSectionFallback />}>
			<UsageLogsContent searchParams={props.searchParams} />
		</Suspense>
	);
}

export async function UsageLogsContent({
	searchParams,
	selectedRequestId = null,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
	selectedRequestId?: string | null;
}) {
	const sp = await searchParams;
	const initialData = await fetchSettingsUsageLogsInitialData(sp);

	if (!initialData.signedIn) redirect("/sign-in");

	if (!initialData.workspaceId) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Usage Logs</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						You need to be signed in and have a team selected to view logs.
					</p>
				</CardContent>
			</Card>
		);
	}

	const view = parseView(
		typeof sp?.view === "string"
			? sp?.view
			: Array.isArray(sp?.view)
				? sp?.view?.[0]
				: undefined,
	);
	const rangeKeys = getUsageRangeParamKeys();
	const preset = parseUsageRangePreset(firstSearchParam(sp?.[rangeKeys.preset]));
	const customFrom = parseUsageDateInput(firstSearchParam(sp?.[rangeKeys.from]));
	const customTo = parseUsageDateInput(firstSearchParam(sp?.[rangeKeys.to]));
	const sessionFilter = firstSearchParam(sp?.session)?.trim() || null;
	const jobKindFilter = firstSearchParam(sp?.job_kind)?.trim() || null;
	const jobStatusFilter = firstSearchParam(sp?.job_status)?.trim() || null;
	const jobProviderFilter = firstSearchParam(sp?.job_provider)?.trim() || null;
	const sessionAppFilter = firstSearchParam(sp?.session_app)?.trim() || null;
	const sessionModelFilter = firstSearchParam(sp?.session_model)?.trim() || null;
	const sessionProviderFilter = firstSearchParam(sp?.session_provider)?.trim() || null;
	const logsPage = parsePositivePage(firstSearchParam(sp?.page));
	const timeRange = resolveUsageTimeRange({
		preset,
		customFrom,
		customTo,
	});

	let content: React.ReactNode;
	let filters: React.ReactNode = null;
	let detailDialog: React.ReactNode = null;

	if (view === "upstream") {
		const data = initialData.view === "upstream" ? initialData.data : null;
		content = (
			<UpstreamRequestsTable
				rows={data?.upstreamRequests ?? []}
				modelMetadata={new Map(data?.modelMetadataEntries ?? [])}
				providerNames={new Map(data?.providerNameEntries ?? [])}
				providerMetadata={new Map(data?.providerMetadataEntries ?? [])}
				keys={new Map((data?.availableKeys ?? []).map((key) => [key.id, key]))}
			/>
		);
	} else if (view === "jobs") {
		const data = initialData.view === "jobs" ? initialData.data : null;
		if (!data) throw new Error("Missing usage jobs data");
		const providerNames = new Map(data.providerNameEntries);
		const modelMetadata = new Map(data.modelMetadataEntries);
		const appMetadata = new Map(data.appMetadataEntries);
		filters = (
			<UsageViewFilters
				view="jobs"
				providers={data.jobProviders}
				providerNames={providerNames}
			/>
		);
		content = (
			<AsyncJobsPanel
				initialJobs={data.recentJobs}
				title="Async jobs"
				description="Recent long-running video and batch jobs, including status, billing, and webhook delivery history."
				emptyMessage="No async jobs found in this workspace yet."
				refreshLimit={50}
				includeWithoutWebhook
				providerNames={providerNames}
				modelMetadata={modelMetadata}
				appMetadata={appMetadata}
				variant="logs"
				timeRange={timeRange}
				showRefreshButton={false}
				kindFilter={
					jobKindFilter === "video" || jobKindFilter === "batch"
						? jobKindFilter
						: null
				}
				statusFilter={jobStatusFilter}
				providerFilter={jobProviderFilter}
			/>
		);
	} else if (view === "sessions") {
		const data = initialData.view === "sessions" ? initialData.data : null;
		if (!data) throw new Error("Missing usage session data");
		const appMetadata = new Map(data.appMetadataEntries);
		const modelMetadata = new Map(data.modelMetadataEntries);
		const providerNames = new Map(data.providerNameEntries);
		const providerMetadata = new Map(data.providerMetadataEntries);
		filters = (
			<UsageViewFilters
				view="sessions"
				appMetadata={appMetadata}
				modelMetadata={modelMetadata}
				providerNames={providerNames}
				providerMetadata={providerMetadata}
				sessionAppIds={data.sessionAppIds}
				sessionModelIds={data.sessionModelIds}
				sessionProviderIds={data.sessionProviderIds}
			/>
		);

		content = (
			<SessionsPanel
				initialSessions={data.sessions}
				initialAppMetadata={appMetadata}
				initialModelMetadata={modelMetadata}
				initialProviderMetadata={providerMetadata}
				initialProviderNames={providerNames}
				timeRange={timeRange}
				showRefreshButton={false}
				appFilter={sessionAppFilter}
				modelFilter={sessionModelFilter}
				providerFilter={sessionProviderFilter}
				sessionFilter={sessionFilter}
			/>
		);
	} else {
		const data = initialData.view === "logs" ? initialData.data : null;
		if (!data) throw new Error("Missing usage logs data");
		const appNames = new Map(data.appNameEntries);
		const providerNames = new Map(data.providerNameEntries);
		const providerMetadata = new Map(data.providerMetadataEntries);
		const modelMetadata = new Map(data.modelMetadataEntries);
		const modelProviders = new Map(data.modelProviderEntries);
		filters = (
			<UsageViewFilters
				view="logs"
				models={data.dedupedModels}
				providers={data.dedupedProviders}
				modelProviders={modelProviders}
				providerNames={providerNames}
				apiKeys={data.availableKeys}
				modelMetadata={modelMetadata}
				providerMetadata={providerMetadata}
			/>
		);

		content = (
			<RequestsSection
				timeRange={timeRange}
				appNames={appNames}
				providerNames={providerNames}
				providerMetadata={providerMetadata}
				modelMetadata={modelMetadata}
				initialPage={logsPage}
				initialRows={data.initialRequestsPage.data}
				initialTotal={data.initialRequestsPage.total}
				initialTotalPages={data.initialRequestsPage.totalPages}
				detailBasePath="/settings/usage/logs"
			/>
		);

		if (selectedRequestId) {
			const investigated = await investigateGeneration(selectedRequestId);
			if (investigated.success && investigated.data) {
				const rows: Array<{ request_id: string }> =
					data.initialRequestsPage.data;
				const currentIndex = rows.findIndex(
					(row) => row.request_id === selectedRequestId,
				);
				detailDialog = (
					<RouteRequestDetailDialog
						detail={investigated.data}
						closeHref={buildLogsRequestHref(sp)}
						previousHref={
							currentIndex > 0
								? buildLogsRequestHref(sp, rows[currentIndex - 1].request_id)
								: null
						}
						nextHref={
							currentIndex >= 0 && currentIndex < rows.length - 1
								? buildLogsRequestHref(sp, rows[currentIndex + 1].request_id)
								: null
						}
					/>
				);
			}
		}
	}
	return (
		<NuqsAdapter>
		<div className="min-w-0 space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
					<p className="mt-1 max-w-3xl text-sm text-muted-foreground">
						Request-level inspection for gateway calls, async work, and sessions.
					</p>
				</div>
				<div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
					{filters}
					<UsageLogsToolbar
						view={view}
						preset={preset}
						customFrom={customFrom}
						customTo={customTo}
					/>
				</div>
			</div>
			<div className="min-w-0 max-w-full space-y-4 overflow-hidden">
				{content}
			</div>
			{detailDialog}
		</div>
		</NuqsAdapter>
	);
}
