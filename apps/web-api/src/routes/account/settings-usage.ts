import { Hono } from "hono";
import { getPrivateGeographyUsage, getWorkspaceModelLastUsed } from "@/repositories/usage-settings";
import { getAvailableUsageKeys, getLifecycleIdMappings, getLifecycleModels, getReplacementModels, getUsageMetadata, getUsageRollupDimensions, loadObservabilityWindow, loadRecentJobs, loadUpstreamAttempts, loadUsageRequestPage } from "@/repositories/usage-observability";
import { getSessionRollups } from "@/repositories/usage-rollups";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { requireUser } from "@/auth/requireUser";
import { requireAccountWorkspace } from "./context";

type Warning = {
	modelId: string; modelName: string | null; organisationId: string | null;
	lastUsedAt: string | null; deprecationDate: string | null; retirementDate: string | null;
	deprecationDaysUntil: number | null; retirementDaysUntil: number | null;
	replacementModelId: string | null; previousModelId: string | null;
	countAsAlert: boolean; severity: "fyi" | "notice" | "warning" | "critical";
};

function daysUntil(value: string | null): number | null {
	if (!value) return null;
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return null;
	const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	const now = new Date();
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return Math.ceil((target - today) / 86_400_000);
}

export const accountSettingsUsageRouter = new Hono<{ Bindings: Env }>();

function usageTimeRange(request: Request) {
	const url = new URL(request.url);
	const now = new Date();
	const customFrom = url.searchParams.get("usage_from");
	const customTo = url.searchParams.get("usage_to");
	if (customFrom && customTo && Number.isFinite(Date.parse(customFrom)) && Number.isFinite(Date.parse(customTo))) {
		return { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() };
	}
	const preset = (url.searchParams.get("usage_preset") ?? "past_24h").toLowerCase();
	const from = new Date(now);
	const relative = preset.match(/^(?:rel:)?(\d+)(mo|m|h|d|w|y)$/);
	if (relative) {
		const amount = Number(relative[1]);
		const unit = relative[2];
		if (unit === "m") from.setMinutes(from.getMinutes() - amount);
		else if (unit === "h") from.setHours(from.getHours() - amount);
		else if (unit === "d") from.setDate(from.getDate() - amount);
		else if (unit === "w") from.setDate(from.getDate() - amount * 7);
		else if (unit === "mo") from.setMonth(from.getMonth() - amount);
		else from.setFullYear(from.getFullYear() - amount);
	} else {
		const durations: Record<string, number> = { live: 5 / 60, past_15m: .25, past_30m: .5, past_hour: 1, past_3h: 3, past_24h: 24, past_2d: 48, last_7d: 168, last_30d: 720, last_90d: 2160, past_1y: 8760 };
		from.setTime(now.getTime() - (durations[preset] ?? 24) * 3_600_000);
	}
	return { from: from.toISOString(), to: now.toISOString() };
}

export async function metadataForIds(env: Env, args: { models?: string[]; providers?: string[]; apps?: string[] }) { return getUsageMetadata(env,args); }

function stringParam(url: URL, name: string) { return url.searchParams.get(name)?.trim() || null; }

accountSettingsUsageRouter.get("/usage/metadata", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const url = new URL(c.req.url);
	const workspaceId = stringParam(url, "workspaceId");
	if (!workspaceId) return c.json({ error: "workspace_required" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const split = (name: string) => (url.searchParams.get(name) ?? "").split(",").map((value) => value.trim()).filter(Boolean).slice(0, 500);
	try {
		const metadata = await metadataForIds(c.env, { models: split("models"), providers: split("providers"), apps: split("apps") });
		return c.json(metadata, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/settings] usage metadata failed", error);
		return c.json({ error: "usage_metadata_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});


accountSettingsUsageRouter.get("/usage/geography", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ signedIn: false, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const url = new URL(c.req.url);
	const workspaceId = stringParam(url, "workspaceId");
	if (!workspaceId) return c.json({ signedIn: true, workspaceId: null, data: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const { from, to } = usageTimeRange(c.req.raw);
	try {
		const data = await getPrivateGeographyUsage(c.env, workspaceId, from, to);
		return c.json({ data, from, to, signedIn: true, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/settings] geography failed", error);
		return c.json({ error: "usage_geography_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountSettingsUsageRouter.get("/usage/observability", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ signedIn: false, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const url = new URL(c.req.url);
	const workspaceId = stringParam(url, "workspaceId");
	if (!workspaceId) return c.json({ signedIn: true, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const from = stringParam(url, "from");
	const to = stringParam(url, "to");
	const previousFrom = stringParam(url, "previousFrom");
	const previousTo = stringParam(url, "previousTo");
	if (![from, to, previousFrom, previousTo].every((value) => value && Number.isFinite(Date.parse(value)))) {
		return c.json({ error: "invalid_time_range" }, 400, PRIVATE_NO_STORE_HEADERS);
	}
	const limit = 5000;
	try {
		const [keyRows, current, previous] = await Promise.all([
			getAvailableUsageKeys(c.env, workspaceId),
			loadObservabilityWindow(c.env,{workspaceId,from:from!,to:to!,limit}),
			loadObservabilityWindow(c.env,{workspaceId,from:previousFrom!,to:previousTo!,limit}),
		]);
		const rows = [...current.rows, ...previous.rows];
		const models = Array.from(new Set(rows.map((row) => String(row.model_id ?? "").trim()).filter(Boolean)));
		const apps = Array.from(new Set(rows.map((row) => String(row.app_id ?? "").trim()).filter(Boolean)));
		const metadata = await metadataForIds(c.env, { models, apps });
		return c.json({
			appMetadataEntries: metadata.appMetadataEntries,
			appNameEntries: metadata.appNameEntries,
			current,
			keys: keyRows,
			modelMetadataEntries: metadata.modelMetadataEntries,
			previous,
			signedIn: true,
			workspaceId,
		}, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/settings] observability failed", error);
		return c.json({ error: "usage_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountSettingsUsageRouter.get("/usage/logs", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	const url = new URL(c.req.url);
	const view = ["upstream", "jobs", "sessions"].includes(url.searchParams.get("view") ?? "") ? url.searchParams.get("view")! : "logs";
	if (!user) return c.json({ data: null, signedIn: false, view, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = stringParam(url, "workspaceId");
	if (!workspaceId) return c.json({ data: null, signedIn: true, view, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const timeRange = usageTimeRange(c.req.raw);
	if (view === "upstream") {
		let upstreamRequests;try{upstreamRequests=await loadUpstreamAttempts(c.env,{workspaceId,from:timeRange.from,to:timeRange.to});}catch{return c.json({error:"usage_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
		const models:string[] = Array.from(new Set<string>(upstreamRequests.map((row) => String(row.model_id ?? "").trim()).filter(Boolean)));
		const providers:string[] = Array.from(new Set<string>(upstreamRequests.map((row) => String(row.provider ?? "").trim()).filter(Boolean)));
		const metadata = await metadataForIds(c.env, { models, providers });
		const availableKeys = await getAvailableUsageKeys(c.env,workspaceId);
		return c.json({ data: { availableKeys, modelMetadataEntries: metadata.modelMetadataEntries, providerMetadataEntries: metadata.providerMetadataEntries, providerNameEntries: metadata.providerNameEntries, upstreamRequests }, signedIn: true, view, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	if (view === "jobs") {
		const rawKind=stringParam(url,"job_kind");const kind=rawKind==="video"||rawKind==="batch"?rawKind:null;let recentJobs;try{recentJobs=await loadRecentJobs(c.env,{workspaceId,from:timeRange.from,to:timeRange.to,kind,status:stringParam(url,"job_status"),provider:stringParam(url,"job_provider")});}catch{return c.json({error:"usage_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
		const models = recentJobs.map((row) => String(row.model ?? "")).filter(Boolean); const providers = recentJobs.map((row) => String(row.provider ?? "")).filter(Boolean); const apps = recentJobs.map((row) => String(row.app_id ?? "")).filter(Boolean);
		const metadata = await metadataForIds(c.env, { models, providers, apps });
		return c.json({ data: { appMetadataEntries: metadata.appMetadataEntries, jobProviders: Array.from(new Set(providers)), modelMetadataEntries: metadata.modelMetadataEntries, providerNameEntries: metadata.providerNameEntries, recentJobs }, signedIn: true, view, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	if (view === "sessions") {
		let sessions;try{sessions=await getSessionRollups(c.env,{workspaceId,from:timeRange.from,to:timeRange.to,limit:100,offset:0,sessionId:stringParam(url,"session"),appId:stringParam(url,"session_app"),modelId:stringParam(url,"session_model"),provider:stringParam(url,"session_provider")});}catch{return c.json({error:"usage_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
		const ids=(value:unknown):string[]=>Array.isArray(value)?value.map(String).filter(Boolean):[];const appIds:string[] = Array.from(new Set<string>(sessions.flatMap((row) => ids(row.app_ids)))); const modelIds:string[] = Array.from(new Set<string>(sessions.flatMap((row) => ids(row.model_ids)))); const providerIds:string[] = Array.from(new Set<string>(sessions.flatMap((row) => ids(row.provider_ids))));
		const metadata = await metadataForIds(c.env, { models: modelIds, providers: providerIds, apps: appIds });
		return c.json({ data: { appMetadataEntries: metadata.appMetadataEntries, modelMetadataEntries: metadata.modelMetadataEntries, providerMetadataEntries: metadata.providerMetadataEntries, providerNameEntries: metadata.providerNameEntries, sessionAppIds: appIds, sessionModelIds: modelIds, sessionProviderIds: providerIds, sessions }, signedIn: true, view, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const page = 1;
	const requestedPageSize = Number.parseInt(stringParam(url, "per_page") ?? "50", 10);
	const pageSize = [25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 50;
	const stringFilters:Array<{column:"model"|"provider"|"app"|"endpoint"|"finishReason"|"errorCode"|"statusCode"|"key"|"requestId"|"session"|"source";value:string;negate:boolean}>=[];
	for (const [param, column, operatorParam = `${param}_op`] of [
		["model", "model"], ["provider", "provider"], ["app", "app"],
		["endpoint", "endpoint"], ["finish_reason", "finishReason", "finish_op"],
		["error_code", "errorCode", "error_op"], ["http_status", "statusCode", "http_op"],
		["key", "key"], ["req", "requestId"], ["session", "session"],
	] as const) {
		const value = stringParam(url, param);
		if (value) stringFilters.push({column,value,negate:stringParam(url,operatorParam)==="is_not"});
	}
	const status = stringParam(url, "status");
	const success=status==="success"||status==="error"?{value:status==="success",negate:stringParam(url,"status_op")==="is_not"}:undefined;
	const stream = stringParam(url, "stream");
	const streamFilter=stream==="streaming"||stream==="non_streaming"?{value:stream==="streaming",negate:stringParam(url,"stream_op")==="is_not"}:undefined;
	const source = stringParam(url, "source");
	if (source) stringFilters.push({column:"source",value:source,negate:stringParam(url,"source_op")==="is_not"});
	const tokenFilters:Array<{column:"input"|"output"|"total";operator:"eq"|"lte"|"gte"|"between";value:number;max?:number}>=[];
	for (const [param, maxParam, operatorParam, column] of [
		["input_tokens", "input_tokens_max", "input_tokens_op", "input"],
		["output_tokens", "output_tokens_max", "output_tokens_op", "output"],
		["total_tokens", "total_tokens_max", "total_tokens_op", "total"],
	] as const) {
		const rawValue = stringParam(url, param);
		if (!rawValue || !/^\d+$/.test(rawValue)) continue;
		const value = Number(rawValue);
		const rawOperator=stringParam(url,operatorParam);const operator=rawOperator==="eq"||rawOperator==="lte"||rawOperator==="between"?rawOperator:"gte";const rawMax=stringParam(url,maxParam);tokenFilters.push({column,operator,value,...(operator==="between"&&rawMax&&/^\d+$/.test(rawMax)?{max:Number(rawMax)}:{})});
	}
	let requestRows;try{requestRows=await loadUsageRequestPage(c.env,{workspaceId,from:timeRange.from,to:timeRange.to,limit:pageSize,stringFilters,success,stream:streamFilter,tokenFilters});}catch{return c.json({error:"usage_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
	const [rollupRows, keyRows] = await Promise.all([getUsageRollupDimensions(c.env,{workspaceId,from:timeRange.from,to:timeRange.to}),getAvailableUsageKeys(c.env,workspaceId)]);
	const hasMoreRequests = requestRows.length > pageSize;
	const visibleRequestRows = requestRows.slice(0, pageSize);
	const values = <T,>(selector: (row: (typeof visibleRequestRows)[number]) => T | null | undefined) => Array.from(new Set(visibleRequestRows.map(selector).filter((value): value is T => value != null && value !== "")));
	const models:string[] = Array.from(new Set<string>([...values((row) => row.model_id), ...rollupRows.map((row) => row.canonical_model_id)].map(String).filter(Boolean)));
	const providers:string[] = Array.from(new Set<string>([...values((row) => row.provider), ...rollupRows.map((row) => row.provider)].map(String).filter(Boolean)));
	const apps:string[] = Array.from(new Set<string>([...values((row) => row.app_id), ...rollupRows.map((row) => row.app_id)].map(String).filter(Boolean)));
	const providerSets = new Map<string, Set<string>>(); for (const row of rollupRows) if (row.canonical_model_id && row.provider) providerSets.set(row.canonical_model_id, new Set([...(providerSets.get(row.canonical_model_id) ?? []), row.provider]));
	const metadata = await metadataForIds(c.env, { models, providers, apps });
	const lastRequestRow = visibleRequestRows.at(-1);
	const nextRequestCursor = hasMoreRequests && lastRequestRow ? { createdAt: lastRequestRow.created_at, id: lastRequestRow.id } : null;
	const clientSources = values((row) => row.client_source_id).map((id) => ({ id, name: visibleRequestRows.find((row) => row.client_source_id === id)?.client_source_name ?? id }));
	const logEndpoints = values((row) => row.endpoint);
	const logFinishReasons = values((row) => row.finish_reason);
	const logErrorCodes = values((row) => row.error_code);
	const logStatusCodes = values((row) => row.status_code).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
	return c.json({ data: { appNameEntries: metadata.appNameEntries, availableKeys: keyRows, clientSources, dedupedModels: models, dedupedProviders: providers, logAppIds: apps, logEndpoints, logFinishReasons, logErrorCodes, logStatusCodes, initialRequestsPage: { data: visibleRequestRows, page, pageSize, hasMore: hasMoreRequests, nextCursor: nextRequestCursor }, modelMetadataEntries: metadata.modelMetadataEntries, modelProviderEntries: Array.from(providerSets.entries()).map(([id, values]) => [id, Array.from(values)]), providerMetadataEntries: metadata.providerMetadataEntries, providerNameEntries: metadata.providerNameEntries }, signedIn: true, view, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsUsageRouter.get("/usage/alerts", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ signedIn: false, warnings: [], workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ signedIn: true, warnings: [], workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const now = Date.now();
	const windowStart = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10);
	const windowEnd = new Date(now + 90 * 86_400_000).toISOString().slice(0, 10);
	let lifecycleModels;try{lifecycleModels=await getLifecycleModels(c.env,{windowStart,windowEnd});}catch{return c.json({error:"usage_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
	const lifecycleIds = lifecycleModels.map((row) => row.model_id).filter(Boolean);
	if (!lifecycleIds.length) return c.json({ signedIn: true, warnings: [], workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	const usageRows = await getWorkspaceModelLastUsed(c.env, workspaceId, new Date(now - 90 * 86_400_000).toISOString()).catch(() => []);
	const usedIds = Array.from(new Set(usageRows.map((row) => String(row.model_id ?? "")).filter(Boolean)));
	const idMap = await getLifecycleIdMappings(c.env,usedIds).catch(()=>new Map<string,string>());
	const lastUsed = new Map<string, string>();
	for (const row of usageRows) {
		const usedId = String(row.model_id ?? "");
		const timestamp = typeof row.last_used_at === "string" ? row.last_used_at : null;
		if (!usedId || !timestamp) continue;
		const internalId = idMap.get(usedId) ?? usedId;
		const previous = lastUsed.get(internalId);
		if (!previous || Date.parse(timestamp) > Date.parse(previous)) lastUsed.set(internalId, timestamp);
	}
	const replacementByPrevious = await getReplacementModels(c.env,lifecycleIds).catch(()=>new Map<string,string>());
	const warnings = lifecycleModels.map((model): Warning => {
		const deprecationDate = model.deprecation_date ?? null;
		const retirementDate = model.retirement_date ?? null;
		const deprecationDaysUntil = daysUntil(deprecationDate);
		const retirementDaysUntil = daysUntil(retirementDate);
		const primary = retirementDaysUntil ?? deprecationDaysUntil;
		const lastUsedAt = lastUsed.get(model.model_id) ?? null;
		const usedRecently = Boolean(lastUsedAt && Date.parse(lastUsedAt) >= now - 90 * 86_400_000);
		let severity: Warning["severity"] = "fyi";
		if (primary != null && primary >= 0 && primary <= 90 && usedRecently) severity = primary <= 7 ? "critical" : primary <= 28 ? "warning" : "notice";
		return { modelId: model.model_id, modelName: model.name ?? null, organisationId: model.organisation_id ?? null, lastUsedAt, deprecationDate, retirementDate, deprecationDaysUntil, retirementDaysUntil, replacementModelId: replacementByPrevious.get(model.model_id) ?? null, previousModelId: model.previous_model_id ?? null, countAsAlert: usedRecently && primary != null && primary >= 0 && primary <= 90, severity };
	}).filter((warning) => [warning.deprecationDaysUntil, warning.retirementDaysUntil].some((days) => days != null && days >= -7 && days <= 90))
		.sort((left, right) => Math.min(left.retirementDaysUntil ?? Infinity, left.deprecationDaysUntil ?? Infinity) - Math.min(right.retirementDaysUntil ?? Infinity, right.deprecationDaysUntil ?? Infinity));
	return c.json({ signedIn: true, warnings, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
});
