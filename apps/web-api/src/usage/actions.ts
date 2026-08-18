import { AsyncLocalStorage } from "node:async_hooks";

import type { Env } from "@/env";
import { getJobsRollup, getSessionRollups, getUsageChartRollup } from "@/repositories/usage-rollups";
import {
	getUsageMetadata,
	loadAsyncJobDetail,
	loadFunStatsRows,
	loadRecentJobs,
	loadRequestInvestigation,
	loadSessionRequests,
	loadUsageRequestPage,
} from "@/repositories/usage-observability";
import type { AccountWorkspaceContext } from "@/routes/account/context";

type UsageExecutionContext = { account: AccountWorkspaceContext; env: Env };
const storage = new AsyncLocalStorage<UsageExecutionContext>();
const current = () => { const value = storage.getStore(); if (!value) throw new Error("usage_context_missing"); return value; };
export function runWithUsageContext<T>(context: UsageExecutionContext, callback: () => Promise<T>) { return storage.run(context, callback); }

function numberOrNull(value: unknown): number | null {
	if (value == null || value === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}
function stringOrNull(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function objectOrNull(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export type RequestRow = Record<string, unknown> & {
	request_id: string; created_at: string; model_id: string | null; provider: string | null;
	app_id: string | null; app_title: string | null; provider_attempts: Array<Record<string, unknown>>;
};

function requestRow(value: Record<string, unknown>): RequestRow {
	return {
		...value,
		request_id: String(value.request_id ?? ""),
		created_at: String(value.created_at ?? ""),
		model_id: stringOrNull(value.model_id ?? value.routed_model_id ?? value.requested_model_id),
		provider: stringOrNull(value.provider),
		app_id: stringOrNull(value.app_id),
		app_title: stringOrNull(value.app_title),
		stream: value.stream === true,
		success: value.success === true,
		cost_nanos: numberOrNull(value.cost_nanos),
		status_code: numberOrNull(value.status_code),
		latency_ms: numberOrNull(value.latency_ms),
		generation_ms: numberOrNull(value.generation_ms),
		usage: objectOrNull(value.usage) ?? {},
		pricing_lines: list(value.pricing_lines),
		provider_attempts: normalizeGatewayUpstreamRows(list(value.provider_attempts)),
	};
}

export function normalizeGatewayUpstreamRows(rows: unknown[]): Array<Record<string, unknown>> {
	return rows.map((value) => {
		const row = objectOrNull(value) ?? {};
		return {
			sequence: numberOrNull(row.sequence), round_number: numberOrNull(row.round_number),
			attempt_number: numberOrNull(row.attempt_number), internal_attempt_number: numberOrNull(row.internal_attempt_number),
			provider: stringOrNull(row.provider), api_model_id: stringOrNull(row.api_model_id),
			provider_model_slug: stringOrNull(row.provider_model_slug), outcome: stringOrNull(row.outcome),
			status: numberOrNull(row.status_code ?? row.status), status_text: stringOrNull(row.status_text),
			duration_ms: numberOrNull(row.duration_ms), latency_ms: numberOrNull(row.latency_ms),
			generation_ms: numberOrNull(row.generation_ms), total_ms: numberOrNull(row.total_ms),
			cost_nanos: numberOrNull(row.cost_nanos), currency: stringOrNull(row.currency),
			finish_reason: stringOrNull(row.finish_reason), provider_finish_reason: stringOrNull(row.provider_finish_reason),
			retryable: typeof row.retryable === "boolean" ? row.retryable : null,
			fallback_attempted: row.fallback_attempted === true,
			upstream_error_code: stringOrNull(row.error_code ?? row.upstream_error_code),
			upstream_error_message: stringOrNull(row.error_message ?? row.upstream_error_message),
			upstream_error_description: stringOrNull(row.error_description ?? row.upstream_error_description),
		};
	});
}

function normalizedIds(ids: string[]) { return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort(); }

export async function fetchOrganizationColors(modelIds: string[]) {
	const metadata = await getUsageMetadata(current().env, { models: normalizedIds(modelIds) });
	const result = new Map<string, string>();
	for (const [id, entry] of metadata.modelMetadataEntries) {
		const colour = entry.organisationColour;
		if (typeof colour === "string" && colour) result.set(String(id), colour);
	}
	return result;
}
export async function fetchModelMetadata(modelIds: string[]) {
	const metadata = await getUsageMetadata(current().env, { models: normalizedIds(modelIds) });
	return new Map(metadata.modelMetadataEntries.map(([id, entry]) => [id, { organisationId: entry.organisationId, organisationName: entry.organisationName, ...(entry.modelName ? { modelName: entry.modelName } : {}) }]));
}
export async function fetchProviderNames(providerIds: string[]) {
	return new Map((await getUsageMetadata(current().env, { providers: normalizedIds(providerIds) })).providerNameEntries);
}
export type ProviderMetadataEntry = { name: string; promptTrainingPolicy: string | null; [key: string]: unknown };
export async function fetchProviderMetadata(providerIds: string[]): Promise<Map<string, ProviderMetadataEntry>> {
	return new Map((await getUsageMetadata(current().env, { providers: normalizedIds(providerIds) })).providerMetadataEntries as Array<[string, ProviderMetadataEntry]>);
}
export async function fetchAppNames(appIds: string[]) {
	return new Map((await getUsageMetadata(current().env, { apps: normalizedIds(appIds) })).appNameEntries);
}
export type AppMetadata = { title: string; imageUrl: string | null; [key: string]: unknown };
export async function fetchAppMetadata(appIds: string[]): Promise<Map<string, AppMetadata>> {
	return new Map((await getUsageMetadata(current().env, { apps: normalizedIds(appIds) })).appMetadataEntries as Array<[string, AppMetadata]>);
}

type PaginatedRequestsParams = Record<string, unknown> & { pageSize?: number; cursor?: { createdAt: string; id: string } | null };
export async function fetchPaginatedRequests(params: PaginatedRequestsParams) {
	const pageSize = [25, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 50;
	const cursor = params.cursor ?? null;
	if (cursor && (
		!Number.isFinite(Date.parse(cursor.createdAt))
		|| !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)
	)) throw new Error("Invalid request cursor");
	const filterOperators = objectOrNull(params.filterOperators) ?? {};
	const stringFilters: Array<{ column: any; value: string; negate: boolean }> = [];
	const add = (column: string, value: unknown, operatorKey = column) => { const text = stringOrNull(value); if (text) stringFilters.push({ column, value: text, negate: filterOperators[operatorKey] === "is_not" }); };
	add("model", params.modelFilter); add("provider", params.providerFilter); add("app", params.appFilter);
	add("endpoint", params.endpointFilter); add("finishReason", params.finishReasonFilter, "finish"); add("requestId", params.requestFilter);
	add("session", params.sessionFilter); add("source", params.sourceFilter); add("errorCode", params.errorCodeFilter, "error");
	if (numberOrNull(params.statusCodeFilter) != null) add("statusCode", String(params.statusCodeFilter), "http");
	add("key", params.keyFilter);
	const status = params.statusFilter === "success" ? { value: true, negate: filterOperators.status === "is_not" } : params.statusFilter === "error" ? { value: false, negate: filterOperators.status === "is_not" } : undefined;
	const stream = params.streamFilter === "streaming" ? { value: true, negate: filterOperators.stream === "is_not" } : params.streamFilter === "non_streaming" ? { value: false, negate: filterOperators.stream === "is_not" } : undefined;
	const tokenFilters: Array<{ column: "input" | "output" | "total"; operator: "eq" | "lte" | "gte" | "between"; value: number; max?: number }> = [];
	for (const [column, valueKey, maxKey, operatorKey] of [["input", "inputTokensFilter", "inputTokensMax", "inputTokensOperator"], ["output", "outputTokensFilter", "outputTokensMax", "outputTokensOperator"], ["total", "totalTokensFilter", "totalTokensMax", "totalTokensOperator"]] as const) {
		const value = numberOrNull(params[valueKey]);
		if (value == null || value < 0) continue;
		const rawOperator = params[operatorKey];
		const operator = rawOperator === "eq" || rawOperator === "lte" || rawOperator === "between" ? rawOperator : "gte";
		const max = numberOrNull(params[maxKey]);
		tokenFilters.push({ column, operator, value, ...(operator === "between" && max != null ? { max } : {}) });
	}
	const rows = await loadUsageRequestPage(current().env, {
		workspaceId: current().account.workspaceId,
		from: String((params.timeRange as any)?.from ?? new Date(0).toISOString()),
		to: String((params.timeRange as any)?.to ?? new Date().toISOString()),
		limit: pageSize,
		cursor,
		stringFilters, success: status, stream, tokenFilters,
	});
	const data = rows.slice(0, pageSize).map((row) => requestRow(row as Record<string, unknown>));
	const hasMore = rows.length > pageSize;
	const last = data.at(-1);
	return { data, pageSize, hasMore, nextCursor: hasMore && last?.id ? { createdAt: last.created_at, id: String(last.id) } : null };
}

export async function investigateGeneration(requestId: string) {
	const id = requestId.trim();
	if (!id) return { success: false, error: "Request ID required" };
	const loaded = await loadRequestInvestigation(current().env, { workspaceId: current().account.workspaceId, requestId: id });
	if (!loaded) return { success: false, error: "Request not found or not authorized" };
	const request = requestRow(loaded.request);
	const providerIds = normalizedIds([request.provider ?? "", ...request.provider_attempts.map((row) => String(row.provider ?? ""))]);
	const [models, providerNames, providerMetadata, apps] = await Promise.all([
		request.model_id ? fetchModelMetadata([request.model_id]) : Promise.resolve(new Map()),
		fetchProviderNames(providerIds), fetchProviderMetadata(providerIds),
		request.app_id ? fetchAppMetadata([request.app_id]) : Promise.resolve(new Map()),
	]);
	return { success: true, data: {
		request,
		appName: request.app_title ?? (request.app_id ? apps.get(request.app_id)?.title ?? null : null),
		modelMetadata: [...models.entries()], providerNames: [...providerNames.entries()],
		providerMetadata: [...providerMetadata.entries()], ioLog: loaded.ioLog,
	} };
}

export async function fetchFunStats(timeRange: { from: string; to: string }) {
	const rows = await loadFunStatsRows(current().env, { workspaceId: current().account.workspaceId, ...timeRange });
	const models = new Map<string, { requests: number; cost: number; latency: number; samples: number }>();
	const providers = new Map<string, number>();
	for (const row of rows) {
		const model = row.modelId ?? "unknown"; const requests = Number(row.requests ?? 0); const cost = Number(row.costNanos ?? 0) / 1e9;
		const item = models.get(model) ?? { requests: 0, cost: 0, latency: 0, samples: 0 };
		item.requests += requests; item.cost += cost; item.latency += Number(row.latencySumMs ?? 0); item.samples += Number(row.latencySamples ?? 0); models.set(model, item);
		const provider = row.provider ?? "unknown"; providers.set(provider, (providers.get(provider) ?? 0) + requests);
	}
	const max = <T,>(items: Iterable<[string, T]>, score: (value: T) => number) => [...items].sort((a, b) => score(b[1]) - score(a[1]))[0] ?? null;
	const topModel = max(models, (value) => value.requests); const topProvider = max(providers, (value) => value);
	const expensive = max(models, (value) => value.cost); const fastest = [...models].filter(([, value]) => value.samples > 0).sort((a, b) => a[1].latency / a[1].samples - b[1].latency / b[1].samples)[0] ?? null;
	return {
		topModel: topModel ? { name: topModel[0], requests: topModel[1].requests } : null,
		topProvider: topProvider ? { name: topProvider[0], requests: topProvider[1] } : null,
		mostExpensive: expensive ? { name: expensive[0], cost: expensive[1].cost } : null,
		fastestModel: fastest ? { name: fastest[0], speedMs: fastest[1].latency / fastest[1].samples } : null,
	};
}

export async function fetchChartData(params: any) {
	const bucket = params.range === "1h" ? "5min" : params.range === "1d" ? "hour" : params.range === "1y" ? "month" : "day";
	const rows = await getUsageChartRollup(current().env, { workspaceId: current().account.workspaceId, from: params.timeRange.from, to: params.timeRange.to, bucket, keyId: params.keyFilter ?? null });
	const buckets = (metric: "requests" | "tokens" | "cost") => {
		const result = new Map<string, Record<string, unknown>>();
		for (const row of rows) { const key = String(row.bucket); const item = result.get(key) ?? { bucket: key }; item[String(row.model_id ?? "unknown")] = Number(row[metric] ?? 0); result.set(key, item); }
		return [...result.values()];
	};
	const totals = { requests: 0, tokens: 0, cost: 0 };
	for (const row of rows) { totals.requests += Number(row.requests ?? 0); totals.tokens += Number(row.tokens ?? 0); totals.cost += Number(row.cost ?? 0); }
	return { requestsChart: buckets("requests"), tokensChart: buckets("tokens"), costChart: buckets("cost"), providerBreakdown: {}, totals: {
		requests: { current: totals.requests, previous: 0, avg: rows.length ? totals.requests / rows.length : 0 },
		tokens: { current: totals.tokens, previous: 0, avg: rows.length ? totals.tokens / rows.length : 0 },
		cost: { current: totals.cost, previous: 0, avg: rows.length ? totals.cost / rows.length : 0 },
	} };
}

export async function fetchSessionRollups(params: any) {
	return await getSessionRollups(current().env, { workspaceId: current().account.workspaceId, from: params.timeRange.from, to: params.timeRange.to, limit: params.limit ?? 100, offset: params.offset ?? 0, sessionId: params.sessionId ?? null, appId: params.appId ?? null, modelId: params.modelId ?? null, provider: params.provider ?? null });
}
export async function fetchSessionRequests(params: { sessionId: string; timeRange?: { from: string; to: string } | null }) {
	const sessionId = params.sessionId.trim(); if (!sessionId) return [];
	return (await loadSessionRequests(current().env, { workspaceId: current().account.workspaceId, sessionId, from: params.timeRange?.from, to: params.timeRange?.to })).map((row) => requestRow(row));
}
export async function fetchJobsRollups(params: any = {}) {
	return await getJobsRollup(current().env, { workspaceId: current().account.workspaceId, limit: params.limit ?? 100, offset: params.offset ?? 0, kind: params.kind ?? null, status: params.status ?? null, sessionId: params.sessionId ?? null, provider: params.provider ?? null });
}

function asyncJobRow(row: Record<string, any>) {
	const meta = objectOrNull(row.meta) ?? {};
	return {
		kind: row.kind, internal_id: row.internal_id ?? row.internalId, request_id: row.request_id ?? row.requestId ?? null,
		session_id: row.session_id ?? row.sessionId ?? null, app_id: row.app_id ?? row.appId ?? null,
		provider: row.provider ?? null, model: row.model ?? null, status: row.status ?? null,
		billed_at: row.billed_at ?? row.billedAt ?? null, created_at: row.created_at ?? row.createdAt,
		updated_at: row.updated_at ?? row.updatedAt, meta, webhook: meta.webhook ?? null,
		job_failure_category: meta.job_failure_category ?? null, job_failure_provider: meta.job_failure_provider ?? null,
		job_failure_hint: meta.job_failure_hint ?? null,
	};
}
export async function fetchRecentAsyncJobs(params?: any) {
	const now = new Date(); const from = params?.timeRange?.from ?? new Date(now.getTime() - 30 * 86_400_000).toISOString(); const to = params?.timeRange?.to ?? now.toISOString();
	const rows = await loadRecentJobs(current().env, { workspaceId: current().account.workspaceId, from, to, kind: params?.kind ?? null, status: params?.status ?? null, provider: params?.provider ?? null });
	return rows.map((row) => asyncJobRow(row)).filter((row) => params?.includeWithoutWebhook === true || row.webhook != null).slice(0, Math.max(1, Math.min(50, Number(params?.limit ?? 20))));
}
export async function fetchAsyncJobDetail(input: { kind: "video" | "batch"; internalId: string }) {
	const loaded = await loadAsyncJobDetail(current().env, { workspaceId: current().account.workspaceId, kind: input.kind, internalId: input.internalId });
	if (!loaded) return null;
	const base = asyncJobRow(loaded.operation as any); const meta = base.meta as Record<string, unknown>; const request = loaded.request;
	return { ...base,
		request_created_at: request?.created_at ?? null, request_endpoint: request?.endpoint ?? null,
		request_model_id: request?.model_id ?? null, request_cost_nanos: numberOrNull(request?.cost_nanos),
		request_pricing_lines: list(request?.pricing_lines), request_provider_attempts: normalizeGatewayUpstreamRows(list(request?.provider_attempts)),
		batch_pricing_lines: list(meta.pricing_lines), webhook_attempts: list(meta.webhookAttempts ?? meta.webhook_attempts),
		job_failure_sample: list(meta.job_failure_sample),
	};
}
