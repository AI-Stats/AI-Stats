import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { getSupabaseAdmin } from "@/runtime/env";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime } from "@/routes/utils";
import {
	isResponse,
	parseOffset,
	parsePathId,
	parsePositiveInt,
	requireCapability,
	requireJsonBody,
	requireOAuthWorkspaceRole,
} from "./route-helpers";

type AuthValue = {
	workspaceId: string;
	userId?: string | null;
	authMethod?: "api_key" | "oauth";
	scopes?: string[];
	oauthScopes?: string[];
};

type FeedbackRow = {
	id: string;
	workspace_id: string;
	request_id: string | null;
	session_id: string | null;
	preset_id: string | null;
	test_run_id: string | null;
	source: string;
	rating: string | null;
	score: number | string | null;
	reason: string | null;
	reason_tags: string[] | null;
	comment: string | null;
	metadata: unknown;
	metadata_dimensions: unknown;
	end_user_id: string | null;
	created_by_user_id: string | null;
	created_at: string;
};

type EventRow = {
	id: string;
	workspace_id: string;
	request_id: string | null;
	session_id: string | null;
	preset_id: string | null;
	test_run_id: string | null;
	category: string;
	event_name: string;
	value: unknown;
	numeric_value: number | string | null;
	metadata: unknown;
	metadata_dimensions: unknown;
	end_user_id: string | null;
	source: string;
	occurred_at: string;
	created_by_user_id: string | null;
	created_at: string;
};

type PresetTestRunRow = {
	id: string;
	workspace_id: string;
	preset_id: string | null;
	baseline_preset_id: string | null;
	name: string | null;
	description: string | null;
	status: string;
	dataset_name: string | null;
	config: unknown;
	summary: unknown;
	started_at: string | null;
	completed_at: string | null;
	created_by_user_id: string | null;
	created_at: string;
	updated_at: string;
};

type TestRunAccessRow = {
	id: string;
	preset_id: string | null;
	baseline_preset_id: string | null;
};

type FeedbackSummaryRow = {
	group_value: string;
	count: number | string;
	positive: number | string;
	negative: number | string;
	partial: number | string;
	average_score: number | string | null;
	ratings: Record<string, number | string> | null;
	last_feedback_at: string | null;
};

const FEEDBACK_SELECT =
	"id,workspace_id,request_id,session_id,preset_id,test_run_id,source,rating,score,reason,reason_tags,comment,metadata,metadata_dimensions,end_user_id,created_by_user_id,created_at";
const EVENT_SELECT =
	"id,workspace_id,request_id,session_id,preset_id,test_run_id,category,event_name,value,numeric_value,metadata,metadata_dimensions,end_user_id,source,occurred_at,created_by_user_id,created_at";
const TEST_RUN_SELECT =
	"id,workspace_id,preset_id,baseline_preset_id,name,description,status,dataset_name,config,summary,started_at,completed_at,created_by_user_id,created_at,updated_at";
const FEEDBACK_RATINGS = new Set([
	"thumbs_up",
	"thumbs_down",
	"correct",
	"partly_correct",
	"incorrect",
	"bad_format",
	"too_slow",
	"too_expensive",
	"unsafe",
	"refused_incorrectly",
	"not_helpful",
	"other",
]);
const TEST_RUN_STATUSES = new Set([
	"pending",
	"running",
	"completed",
	"failed",
	"cancelled",
]);

function normalizeText(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, maxLength);
}

function normalizeUuid(value: unknown): string | null {
	const text = normalizeText(value, 128);
	return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
		? text
		: null;
}

function normalizeAllowedText(value: unknown, allowed: ReadonlySet<string>): string | null {
	const text = normalizeText(value, 64);
	return text && allowed.has(text) ? text : null;
}

function normalizeStringArray(value: unknown, maxItems = 20): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => normalizeText(item, 64))
		.filter((item): item is string => Boolean(item))
		.slice(0, maxItems);
}

function normalizeJsonObject(value: unknown, maxBytes = 32_768): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	try {
		const encoded = JSON.stringify(value);
		if (encoded.length <= maxBytes) return value as Record<string, unknown>;
		return { _truncated: true, _original_size_bytes: encoded.length };
	} catch {
		return { _invalid_json_payload: true };
	}
}

function normalizeMetadataDimensions(
	explicitDimensions: unknown,
	metadata: Record<string, unknown>,
	maxItems = 32,
): Record<string, string> {
	const source =
		explicitDimensions && typeof explicitDimensions === "object" && !Array.isArray(explicitDimensions)
			? explicitDimensions
			: metadata.dimensions && typeof metadata.dimensions === "object" && !Array.isArray(metadata.dimensions)
				? metadata.dimensions
				: metadata;
	const dimensions: Record<string, string> = {};
	for (const [rawKey, rawValue] of Object.entries(source as Record<string, unknown>)) {
		if (Object.keys(dimensions).length >= maxItems) break;
		const key = rawKey.trim().slice(0, 64);
		if (!/^[a-zA-Z0-9_.:-]+$/.test(key)) continue;
		if (rawValue === null || rawValue === undefined) continue;
		if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") continue;
		const value = String(rawValue).trim().slice(0, 256);
		if (!value) continue;
		dimensions[key] = value;
	}
	return dimensions;
}

function normalizeScore(value: unknown): number | null | "invalid" {
	if (value === null || value === undefined || value === "") return null;
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) return "invalid";
	return numeric;
}

function normalizeTimestamp(value: unknown): string | null | "invalid" {
	const text = normalizeText(value, 64);
	if (!text) return null;
	const timestamp = new Date(text);
	return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : "invalid";
}

function normalizeJsonValue(value: unknown, maxBytes = 32_768): { value: unknown; valid: boolean } {
	if (value === undefined) return { value: null, valid: true };
	try {
		return JSON.stringify(value).length <= maxBytes
			? { value, valid: true }
			: { value: null, valid: false };
	} catch {
		return { value: null, valid: false };
	}
}

function normalizeNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : null;
}

function normalizeSource(value: unknown): "api" | "user" | "system" | "import" | "test" {
	const text = normalizeText(value, 32);
	if (text === "user" || text === "system" || text === "import" || text === "test") return text;
	return "api";
}

function normalizeEventCategory(value: unknown): "feedback" | "behavior" | "outcome" | "app" | "test" | "custom" {
	const text = normalizeText(value, 32);
	if (text === "feedback" || text === "behavior" || text === "outcome" || text === "app" || text === "test") return text;
	return "custom";
}

function formatFeedback(row: FeedbackRow) {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		request_id: row.request_id,
		session_id: row.session_id,
		preset_id: row.preset_id,
		test_run_id: row.test_run_id,
		source: row.source,
		rating: row.rating,
		score: row.score == null ? null : Number(row.score),
		reason: row.reason,
		reason_tags: row.reason_tags ?? [],
		comment: row.comment,
		metadata: row.metadata ?? {},
		metadata_dimensions: row.metadata_dimensions ?? {},
		end_user_id: row.end_user_id,
		created_by_user_id: row.created_by_user_id,
		created_at: row.created_at,
	};
}

function formatEvent(row: EventRow) {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		request_id: row.request_id,
		session_id: row.session_id,
		preset_id: row.preset_id,
		test_run_id: row.test_run_id,
		category: row.category,
		event_name: row.event_name,
		value: row.value ?? null,
		numeric_value: row.numeric_value == null ? null : Number(row.numeric_value),
		metadata: row.metadata ?? {},
		metadata_dimensions: row.metadata_dimensions ?? {},
		end_user_id: row.end_user_id,
		source: row.source,
		occurred_at: row.occurred_at,
		created_by_user_id: row.created_by_user_id,
		created_at: row.created_at,
	};
}

function formatTestRun(row: PresetTestRunRow) {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		preset_id: row.preset_id,
		baseline_preset_id: row.baseline_preset_id,
		name: row.name,
		description: row.description,
		status: row.status,
		dataset_name: row.dataset_name,
		config: row.config ?? {},
		summary: row.summary ?? {},
		started_at: row.started_at,
		completed_at: row.completed_at,
		created_by_user_id: row.created_by_user_id,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}

async function authorize(req: Request, capability: string, roles: string[]) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return { response: (auth as GuardErr).response };
	const scopeError = requireCapability(auth.value, capability);
	if (scopeError) return { response: scopeError };
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, roles);
	if (roleError) return { response: roleError };
	return { auth: auth.value as AuthValue };
}

async function ensurePresetAccess(workspaceId: string, presetId: string | null): Promise<Response | null> {
	if (!presetId) return null;
	const { data, error } = await getSupabaseAdmin()
		.from("presets")
		.select("id")
		.eq("workspace_id", workspaceId)
		.eq("id", presetId)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "not_found", message: "Preset not found" }, 404, { "Cache-Control": "no-store" });
	return null;
}

async function ensureRequestAccess(workspaceId: string, requestId: string | null): Promise<Response | null> {
	if (!requestId) return null;
	const { data, error } = await getSupabaseAdmin()
		.from("gateway_requests")
		.select("id")
		.eq("workspace_id", workspaceId)
		.eq("request_id", requestId)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "not_found", message: "Request not found in this workspace" }, 404, { "Cache-Control": "no-store" });
	return null;
}

async function ensureTestRunAccess(workspaceId: string, testRunId: string | null): Promise<TestRunAccessRow | Response | null> {
	if (!testRunId) return null;
	const { data, error } = await getSupabaseAdmin()
		.from("gateway_preset_test_runs")
		.select("id,preset_id,baseline_preset_id")
		.eq("workspace_id", workspaceId)
		.eq("id", testRunId)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "not_found", message: "Preset test run not found" }, 404, { "Cache-Control": "no-store" });
	return data as TestRunAccessRow;
}

function validatePresetMatchesTestRun(presetId: string | null, testRun: TestRunAccessRow | null): Response | null {
	if (!presetId || !testRun) return null;
	if (testRun.preset_id === presetId || testRun.baseline_preset_id === presetId) return null;
	return json(
		{ error: "bad_request", message: "Preset does not belong to the supplied test run" },
		400,
		{ "Cache-Control": "no-store" },
	);
}

function applyTargetFilters(query: any, url: URL) {
	for (const [param, column] of [
		["request_id", "request_id"],
		["session_id", "session_id"],
		["preset_id", "preset_id"],
		["test_run_id", "test_run_id"],
	] as const) {
		const value = url.searchParams.get(param)?.trim();
		if (value) query = query.eq(column, value);
	}
	return query;
}

function collectMetadataFilters(url: URL): Record<string, string> {
	const filters: Record<string, string> = {};
	for (const [param, value] of url.searchParams.entries()) {
		if (!param.startsWith("metadata.")) continue;
		const key = param.slice("metadata.".length).trim().slice(0, 64);
		if (!/^[a-zA-Z0-9_.:-]+$/.test(key)) continue;
		const normalizedValue = value.trim().slice(0, 256);
		if (!normalizedValue) continue;
		filters[key] = normalizedValue;
	}
	return filters;
}

function applyMetadataFilters(query: any, url: URL) {
	for (const [key, value] of Object.entries(collectMetadataFilters(url))) {
		query = query.contains("metadata_dimensions", { [key]: value });
	}
	return query;
}

function readDateFilters(url: URL) {
	const since = normalizeText(
		url.searchParams.get("created_after") ??
			url.searchParams.get("created_since") ??
			url.searchParams.get("since"),
		64,
	);
	const until = normalizeText(
		url.searchParams.get("created_before") ??
			url.searchParams.get("created_until") ??
			url.searchParams.get("until"),
		64,
	);
	const normalizedSince = normalizeTimestamp(since);
	const normalizedUntil = normalizeTimestamp(until);
	return {
		since: normalizedSince,
		until: normalizedUntil,
		valid: normalizedSince !== "invalid" && normalizedUntil !== "invalid",
	};
}

function hasInvalidUuidFilter(url: URL): boolean {
	return ["preset_id", "test_run_id"].some((param) => {
		const value = url.searchParams.get(param)?.trim();
		return Boolean(value && !normalizeUuid(value));
	});
}

function applyDateFilters(
	query: any,
	filters: ReturnType<typeof readDateFilters>,
	column: "created_at" | "occurred_at" = "created_at",
) {
	if (filters.since && filters.since !== "invalid") query = query.gte(column, filters.since);
	if (filters.until && filters.until !== "invalid") query = query.lte(column, filters.until);
	return query;
}

async function handleCreateFeedback(req: Request) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_WRITE, ["owner", "admin", "member"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;

	const requestId = normalizeText(body.requestId ?? body.request_id, 128);
	const sessionId = normalizeText(body.sessionId ?? body.session_id, 128);
	const presetId = normalizeUuid(body.presetId ?? body.preset_id);
	const testRunId = normalizeUuid(body.testRunId ?? body.test_run_id);
	if (!requestId && !sessionId && !presetId && !testRunId) {
		return json({ error: "bad_request", message: "Feedback must target a request, session, preset, or test run" }, 400, { "Cache-Control": "no-store" });
	}
	const presetError = await ensurePresetAccess(auth.workspaceId, presetId);
	if (presetError) return presetError;
	const requestError = await ensureRequestAccess(auth.workspaceId, requestId);
	if (requestError) return requestError;
	const testRun = await ensureTestRunAccess(auth.workspaceId, testRunId);
	if (isResponse(testRun)) return testRun;
	const presetMismatchError = validatePresetMatchesTestRun(presetId, testRun);
	if (presetMismatchError) return presetMismatchError;
	const linkedPresetId = presetId ?? testRun?.preset_id ?? null;
	const metadata = normalizeJsonObject(body.metadata);
	const metadataDimensions = normalizeMetadataDimensions(
		body.metadataDimensions ?? body.metadata_dimensions,
		metadata,
	);
	const rating = normalizeAllowedText(body.rating, FEEDBACK_RATINGS);
	if (body.rating != null && !rating) {
		return json({ error: "bad_request", message: "Unsupported feedback rating" }, 400, { "Cache-Control": "no-store" });
	}
	const score = normalizeScore(body.score);
	if (score === "invalid") {
		return json({ error: "bad_request", message: "score must be between 0 and 1" }, 400, { "Cache-Control": "no-store" });
	}

	const payload = {
		workspace_id: auth.workspaceId,
		request_id: requestId,
		session_id: sessionId,
		preset_id: linkedPresetId,
		test_run_id: testRunId,
		source: normalizeSource(body.source),
		rating,
		score,
		reason: normalizeText(body.reason, 128),
		reason_tags: normalizeStringArray(body.reasonTags ?? body.reason_tags),
		comment: normalizeText(body.comment, 2048),
		metadata,
		metadata_dimensions: metadataDimensions,
		end_user_id: normalizeText(body.endUserId ?? body.end_user_id, 128),
		created_by_user_id: normalizeUuid(auth.userId),
	};

	const { data, error } = await getSupabaseAdmin()
		.from("gateway_feedback")
		.insert(payload)
		.select(FEEDBACK_SELECT)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "failed", message: "Feedback was not persisted" }, 500, { "Cache-Control": "no-store" });
	return json({ data: formatFeedback(data as FeedbackRow) }, 201, { "Cache-Control": "no-store" });
}

async function handleListFeedback(req: Request) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_READ, ["owner", "admin", "member"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const url = new URL(req.url);
	const limit = parsePositiveInt(url.searchParams.get("limit"), 100, 500);
	const offset = parseOffset(url.searchParams.get("offset"));
	const dateFilters = readDateFilters(url);
	if (!dateFilters.valid) return json({ error: "bad_request", message: "Invalid date filter" }, 400, { "Cache-Control": "no-store" });
	if (hasInvalidUuidFilter(url)) return json({ error: "bad_request", message: "Invalid preset or test run id" }, 400, { "Cache-Control": "no-store" });

	let query: any = getSupabaseAdmin()
		.from("gateway_feedback")
		.select(FEEDBACK_SELECT)
		.eq("workspace_id", auth.workspaceId)
		.order("created_at", { ascending: false })
		.order("id", { ascending: false })
		.range(offset, offset + limit - 1);
	query = applyTargetFilters(query, url);
	query = applyMetadataFilters(query, url);
	query = applyDateFilters(query, dateFilters);
	const rating = url.searchParams.get("rating")?.trim();
	if (rating) query = query.eq("rating", rating);

	const { data, error } = await query;
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	return json({ data: (data ?? []).map((row) => formatFeedback(row as FeedbackRow)) }, 200, { "Cache-Control": "no-store" });
}

async function handleFeedbackSummary(req: Request) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_READ, ["owner", "admin", "member"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const url = new URL(req.url);
	const rawGroupBy = url.searchParams.get("group_by") ?? "preset";
	if (!new Set(["preset", "preset_id", "test_run", "test_run_id", "metadata"]).has(rawGroupBy)) {
		return json({ error: "bad_request", message: "Unsupported feedback summary grouping" }, 400, { "Cache-Control": "no-store" });
	}
	const groupBy = rawGroupBy === "test_run" || rawGroupBy === "test_run_id" ? "test_run_id" : rawGroupBy === "metadata" ? "metadata" : "preset_id";
	const metadataKey = normalizeText(url.searchParams.get("metadata_key"), 64);
	if (groupBy === "metadata" && (!metadataKey || !/^[a-zA-Z0-9_.:-]+$/.test(metadataKey))) {
		return json({ error: "bad_request", message: "metadata_key is required for metadata grouping" }, 400, { "Cache-Control": "no-store" });
	}

	const limit = parsePositiveInt(url.searchParams.get("limit"), 5000, 10000);
	const dateFilters = readDateFilters(url);
	if (!dateFilters.valid) return json({ error: "bad_request", message: "Invalid date filter" }, 400, { "Cache-Control": "no-store" });
	const rawPresetId = url.searchParams.get("preset_id");
	const rawTestRunId = url.searchParams.get("test_run_id");
	const presetId = normalizeUuid(rawPresetId);
	const testRunId = normalizeUuid(rawTestRunId);
	if ((rawPresetId && !presetId) || (rawTestRunId && !testRunId)) {
		return json({ error: "bad_request", message: "Invalid preset or test run id" }, 400, { "Cache-Control": "no-store" });
	}

	const { data, error } = await getSupabaseAdmin().rpc("gateway_feedback_summary", {
		p_workspace_id: auth.workspaceId,
		p_group_by: groupBy,
		p_metadata_key: groupBy === "metadata" ? metadataKey : null,
		p_request_id: normalizeText(url.searchParams.get("request_id"), 128),
		p_session_id: normalizeText(url.searchParams.get("session_id"), 128),
		p_preset_id: presetId,
		p_test_run_id: testRunId,
		p_created_since: dateFilters.since,
		p_created_until: dateFilters.until,
		p_metadata_filters: collectMetadataFilters(url),
		p_limit: limit,
	});
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });

	return json({
		group_by: groupBy,
		data: ((data ?? []) as FeedbackSummaryRow[]).map((row) => ({
			...(groupBy === "metadata"
				? { metadata_key: metadataKey, metadata_value: row.group_value }
				: { [groupBy]: row.group_value }),
			count: Number(row.count),
			positive: Number(row.positive),
			negative: Number(row.negative),
			partial: Number(row.partial),
			average_score: row.average_score == null ? null : Number(row.average_score),
			ratings: Object.fromEntries(
				Object.entries(row.ratings ?? {}).map(([rating, count]) => [rating, Number(count)]),
			),
			last_feedback_at: row.last_feedback_at,
		})),
	}, 200, { "Cache-Control": "no-store" });
}

async function handleCreateEvent(req: Request) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_WRITE, ["owner", "admin", "member"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;

	const requestId = normalizeText(body.requestId ?? body.request_id, 128);
	const sessionId = normalizeText(body.sessionId ?? body.session_id, 128);
	const presetId = normalizeUuid(body.presetId ?? body.preset_id);
	const testRunId = normalizeUuid(body.testRunId ?? body.test_run_id);
	const eventName = normalizeText(body.event ?? body.eventName ?? body.event_name, 128);
	if (!eventName) return json({ error: "bad_request", message: "event name is required" }, 400, { "Cache-Control": "no-store" });
	if (!requestId && !sessionId && !presetId && !testRunId) {
		return json({ error: "bad_request", message: "Event must target a request, session, preset, or test run" }, 400, { "Cache-Control": "no-store" });
	}
	const presetError = await ensurePresetAccess(auth.workspaceId, presetId);
	if (presetError) return presetError;
	const requestError = await ensureRequestAccess(auth.workspaceId, requestId);
	if (requestError) return requestError;
	const testRun = await ensureTestRunAccess(auth.workspaceId, testRunId);
	if (isResponse(testRun)) return testRun;
	const presetMismatchError = validatePresetMatchesTestRun(presetId, testRun);
	if (presetMismatchError) return presetMismatchError;
	const linkedPresetId = presetId ?? testRun?.preset_id ?? null;
	const metadata = normalizeJsonObject(body.metadata);
	const metadataDimensions = normalizeMetadataDimensions(
		body.metadataDimensions ?? body.metadata_dimensions,
		metadata,
	);

	const occurredAt = normalizeTimestamp(body.occurredAt ?? body.occurred_at);
	if (occurredAt === "invalid") {
		return json({ error: "bad_request", message: "Invalid occurred_at timestamp" }, 400, { "Cache-Control": "no-store" });
	}
	const normalizedValue = normalizeJsonValue(body.value);
	if (!normalizedValue.valid) {
		return json({ error: "bad_request", message: "Event value exceeds the 32 KiB limit" }, 400, { "Cache-Control": "no-store" });
	}
	const payload = {
		workspace_id: auth.workspaceId,
		request_id: requestId,
		session_id: sessionId,
		preset_id: linkedPresetId,
		test_run_id: testRunId,
		category: normalizeEventCategory(body.category),
		event_name: eventName,
		value: normalizedValue.value,
		numeric_value: normalizeNumber(body.numericValue ?? body.numeric_value),
		metadata,
		metadata_dimensions: metadataDimensions,
		end_user_id: normalizeText(body.endUserId ?? body.end_user_id, 128),
		source: normalizeSource(body.source),
		occurred_at: occurredAt ?? new Date().toISOString(),
		created_by_user_id: normalizeUuid(auth.userId),
	};

	const { data, error } = await getSupabaseAdmin()
		.from("gateway_observability_events")
		.insert(payload)
		.select(EVENT_SELECT)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "failed", message: "Event was not persisted" }, 500, { "Cache-Control": "no-store" });
	return json({ data: formatEvent(data as EventRow) }, 201, { "Cache-Control": "no-store" });
}

async function handleListEvents(req: Request) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_READ, ["owner", "admin", "member"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const url = new URL(req.url);
	const limit = parsePositiveInt(url.searchParams.get("limit"), 100, 500);
	const offset = parseOffset(url.searchParams.get("offset"));
	const dateFilters = readDateFilters(url);
	if (!dateFilters.valid) return json({ error: "bad_request", message: "Invalid date filter" }, 400, { "Cache-Control": "no-store" });
	if (hasInvalidUuidFilter(url)) return json({ error: "bad_request", message: "Invalid preset or test run id" }, 400, { "Cache-Control": "no-store" });

	let query: any = getSupabaseAdmin()
		.from("gateway_observability_events")
		.select(EVENT_SELECT)
		.eq("workspace_id", auth.workspaceId)
		.order("occurred_at", { ascending: false })
		.order("id", { ascending: false })
		.range(offset, offset + limit - 1);
	query = applyTargetFilters(query, url);
	query = applyMetadataFilters(query, url);
	query = applyDateFilters(query, dateFilters, "occurred_at");
	const category = url.searchParams.get("category")?.trim();
	if (category) query = query.eq("category", category);
	const eventName = url.searchParams.get("event")?.trim() ?? url.searchParams.get("event_name")?.trim();
	if (eventName) query = query.eq("event_name", eventName);

	const { data, error } = await query;
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	return json({ data: (data ?? []).map((row) => formatEvent(row as EventRow)) }, 200, { "Cache-Control": "no-store" });
}

async function handleCreateTestRun(req: Request) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_WRITE, ["owner", "admin"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const presetId = normalizeUuid(body.presetId ?? body.preset_id);
	const baselinePresetId = normalizeUuid(body.baselinePresetId ?? body.baseline_preset_id);
	const presetError = await ensurePresetAccess(auth.workspaceId, presetId);
	if (presetError) return presetError;
	const baselineError = await ensurePresetAccess(auth.workspaceId, baselinePresetId);
	if (baselineError) return baselineError;
	const status = normalizeAllowedText(body.status, TEST_RUN_STATUSES) ?? "pending";
	if (body.status != null && !normalizeAllowedText(body.status, TEST_RUN_STATUSES)) {
		return json({ error: "bad_request", message: "Unsupported test run status" }, 400, { "Cache-Control": "no-store" });
	}
	const startedAt = normalizeTimestamp(body.startedAt ?? body.started_at);
	const completedAt = normalizeTimestamp(body.completedAt ?? body.completed_at);
	if (startedAt === "invalid" || completedAt === "invalid") {
		return json({ error: "bad_request", message: "Invalid test run timestamp" }, 400, { "Cache-Control": "no-store" });
	}

	const payload = {
		workspace_id: auth.workspaceId,
		preset_id: presetId,
		baseline_preset_id: baselinePresetId,
		name: normalizeText(body.name, 160),
		description: normalizeText(body.description, 1000),
		status,
		dataset_name: normalizeText(body.datasetName ?? body.dataset_name, 160),
		config: normalizeJsonObject(body.config),
		summary: normalizeJsonObject(body.summary),
		started_at: startedAt,
		completed_at: completedAt,
		created_by_user_id: normalizeUuid(auth.userId),
	};

	const { data, error } = await getSupabaseAdmin()
		.from("gateway_preset_test_runs")
		.insert(payload)
		.select(TEST_RUN_SELECT)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "failed", message: "Test run was not persisted" }, 500, { "Cache-Control": "no-store" });
	return json({ data: formatTestRun(data as PresetTestRunRow) }, 201, { "Cache-Control": "no-store" });
}

async function handleListTestRuns(req: Request) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_READ, ["owner", "admin", "member"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const url = new URL(req.url);
	const limit = parsePositiveInt(url.searchParams.get("limit"), 100, 250);
	const offset = parseOffset(url.searchParams.get("offset"));
	let query: any = getSupabaseAdmin()
		.from("gateway_preset_test_runs")
		.select(TEST_RUN_SELECT)
		.eq("workspace_id", auth.workspaceId)
		.order("created_at", { ascending: false })
		.order("id", { ascending: false })
		.range(offset, offset + limit - 1);
	const presetId = url.searchParams.get("preset_id")?.trim();
	if (presetId && !normalizeUuid(presetId)) return json({ error: "bad_request", message: "Invalid preset id" }, 400, { "Cache-Control": "no-store" });
	if (presetId) query = query.eq("preset_id", presetId);
	const { data, error } = await query;
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	return json({ data: (data ?? []).map((row) => formatTestRun(row as PresetTestRunRow)) }, 200, { "Cache-Control": "no-store" });
}

async function handleGetOrUpdateTestRun(req: Request) {
	const id = parsePathId(new URL(req.url), "preset-test-runs");
	if (!id) return json({ error: "bad_request", message: "Test run id is required" }, 400, { "Cache-Control": "no-store" });
	if (req.method === "PATCH") return handleUpdateTestRun(req, id);

	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_READ, ["owner", "admin", "member"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const { data, error } = await getSupabaseAdmin()
		.from("gateway_preset_test_runs")
		.select(TEST_RUN_SELECT)
		.eq("workspace_id", auth.workspaceId)
		.eq("id", id)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "not_found", message: "Preset test run not found" }, 404, { "Cache-Control": "no-store" });

	const feedbackUrl = new URL(req.url);
	feedbackUrl.searchParams.set("group_by", "test_run");
	feedbackUrl.searchParams.set("test_run_id", id);
	const feedbackSummaryResponse = await handleFeedbackSummary(new Request(feedbackUrl.toString(), req));
	const feedbackSummary = await feedbackSummaryResponse.json().catch(() => null);
	return json({ data: formatTestRun(data as PresetTestRunRow), feedback_summary: feedbackSummary?.data?.[0] ?? null }, 200, { "Cache-Control": "no-store" });
}

async function handleUpdateTestRun(req: Request, id: string) {
	const authorized = await authorize(req, CAPABILITIES.FEEDBACK_WRITE, ["owner", "admin"]);
	if (authorized.response) return authorized.response;
	const auth = authorized.auth;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (body.status !== undefined) {
		const status = normalizeAllowedText(body.status, TEST_RUN_STATUSES);
		if (!status) {
			return json({ error: "bad_request", message: "Unsupported test run status" }, 400, { "Cache-Control": "no-store" });
		}
		update.status = status;
	}
	if (body.summary !== undefined) update.summary = normalizeJsonObject(body.summary);
	if (body.completedAt !== undefined || body.completed_at !== undefined) {
		const completedAt = normalizeTimestamp(body.completedAt ?? body.completed_at);
		if (completedAt === "invalid") return json({ error: "bad_request", message: "Invalid completed_at timestamp" }, 400, { "Cache-Control": "no-store" });
		update.completed_at = completedAt;
	}
	if (body.startedAt !== undefined || body.started_at !== undefined) {
		const startedAt = normalizeTimestamp(body.startedAt ?? body.started_at);
		if (startedAt === "invalid") return json({ error: "bad_request", message: "Invalid started_at timestamp" }, 400, { "Cache-Control": "no-store" });
		update.started_at = startedAt;
	}
	if (body.name !== undefined) update.name = normalizeText(body.name, 160);
	if (body.description !== undefined) update.description = normalizeText(body.description, 1000);

	const { data, error } = await getSupabaseAdmin()
		.from("gateway_preset_test_runs")
		.update(update)
		.eq("workspace_id", auth.workspaceId)
		.eq("id", id)
		.select(TEST_RUN_SELECT)
		.maybeSingle();
	if (error) return json({ error: "failed", message: error.message }, 500, { "Cache-Control": "no-store" });
	if (!data) return json({ error: "not_found", message: "Preset test run not found" }, 404, { "Cache-Control": "no-store" });
	return json({ data: formatTestRun(data as PresetTestRunRow) }, 200, { "Cache-Control": "no-store" });
}

export const feedbackRoutes = new Hono<Env>();
export const observabilityEventsRoutes = new Hono<Env>();
export const presetTestRunsRoutes = new Hono<Env>();

feedbackRoutes.get("/summary", withRuntime(handleFeedbackSummary));
feedbackRoutes.get("/", withRuntime(handleListFeedback));
feedbackRoutes.post("/", withRuntime(handleCreateFeedback));

observabilityEventsRoutes.get("/", withRuntime(handleListEvents));
observabilityEventsRoutes.post("/", withRuntime(handleCreateEvent));

presetTestRunsRoutes.get("/", withRuntime(handleListTestRuns));
presetTestRunsRoutes.post("/", withRuntime(handleCreateTestRun));
presetTestRunsRoutes.get("/:id", withRuntime(handleGetOrUpdateTestRun));
presetTestRunsRoutes.patch("/:id", withRuntime(handleGetOrUpdateTestRun));
