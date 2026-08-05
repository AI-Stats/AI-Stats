import { getBindings, getSupabaseAdmin } from "@/runtime/env";
import {
	buildAsyncGenAiOtlpPayload,
	buildGatewayGenAiOtlpPayload,
	type AsyncGenAiTelemetry,
	type GatewayGenAiTelemetry,
	type GatewayOtlpBuildOptions,
} from "./otel-genai";

type Rule = { field: string; condition: string; value: string | null };
type Destination = {
	id: string;
	destination_config: Record<string, unknown> | null;
	privacy_exclude_prompts_and_outputs?: boolean | null;
	sampling_rate?: number | string | null;
	group_join_operator?: "and" | "or" | null;
	broadcast_destination_keys?: Array<{ key_id: string }> | null;
	broadcast_destination_rule_groups?: Array<{
		match_operator?: "and" | "or" | null;
		broadcast_destination_rules?: Rule[] | null;
	}> | null;
};
type OutboxRow = {
	id: string;
	destination_id: string;
	payload: unknown;
	attempts: number;
};

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_ATTEMPTS = 8;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function object(value: unknown): Record<string, any> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, any>
		: {};
}

function finite(value: unknown): number | null {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function stableSample(eventId: string, destinationId: string, rate: number): boolean {
	if (rate >= 1) return true;
	if (rate <= 0) return false;
	let hash = 2166136261;
	for (const char of `${eventId}:${destinationId}`) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 0x1_0000_0000 < rate;
}

function usageValues(rawUsage: unknown) {
	const raw = object(rawUsage);
	const input = finite(raw.input_tokens ?? raw.prompt_tokens);
	const output = finite(raw.output_tokens ?? raw.completion_tokens);
	return {
		input,
		output,
		total: finite(raw.total_tokens) ?? ((input ?? 0) + (output ?? 0)),
	};
}

function ruleValues(args: GatewayGenAiTelemetry): Record<string, unknown> {
	const tokens = usageValues(args.usage);
	return {
		model: args.requestedModel,
		provider: args.provider,
		session_id: args.sessionId,
		user_id: args.userId,
		api_key_name: args.keyName,
		finish_reason: args.finishReason,
		input: JSON.stringify(args.requestPayload ?? null).slice(0, 16_000),
		output: JSON.stringify(args.responsePayload ?? null).slice(0, 16_000),
		total_cost: args.totalNanos,
		total_tokens: tokens.total,
		prompt_tokens: tokens.input,
		completion_tokens: tokens.output,
	};
}

function matchRule(rule: Rule, values: Record<string, unknown>): boolean {
	const raw = values[rule.field];
	const actual = raw === null || raw === undefined ? "" : String(raw);
	const expected = rule.value ?? "";
	switch (rule.condition) {
		case "equals": return actual === expected;
		case "not_equals": return actual !== expected;
		case "contains": return actual.includes(expected);
		case "not_contains": return !actual.includes(expected);
		case "starts_with": return actual.startsWith(expected);
		case "ends_with": return actual.endsWith(expected);
		case "exists": return actual !== "";
		case "not_exists": return actual === "";
		case "matches_regex":
			if (expected.length > 128 || actual.length > 2_000) return false;
			try {
				return new RegExp(expected).test(actual);
			} catch {
				return false;
			}
		default: return false;
	}
}

function selected(destination: Destination, args: GatewayGenAiTelemetry, eventId: string): boolean {
	const keys = destination.broadcast_destination_keys ?? [];
	if (keys.length && !keys.some((entry) => entry.key_id === args.keyId)) return false;
	const rate = Math.max(0, Math.min(1, finite(destination.sampling_rate) ?? 1));
	if (!stableSample(eventId, destination.id, rate)) return false;
	const groups = destination.broadcast_destination_rule_groups ?? [];
	if (!groups.length) return true;
	const values = ruleValues(args);
	const matches = groups.map((group) => {
		const rules = group.broadcast_destination_rules ?? [];
		if (!rules.length) return true;
		const results = rules.map((rule) => matchRule(rule, values));
		return group.match_operator === "or" ? results.some(Boolean) : results.every(Boolean);
	});
	return destination.group_join_operator === "and" ? matches.every(Boolean) : matches.some(Boolean);
}

function buildOptions(destination: Destination): GatewayOtlpBuildOptions {
	const bindings = getBindings();
	return {
		includeSensitiveContent: destination.privacy_exclude_prompts_and_outputs !== true,
		serviceName: "phaseo-gateway",
		serviceVersion: bindings.NEXT_PUBLIC_GATEWAY_VERSION ?? null,
		environment: bindings.NODE_ENV ?? null,
	};
}

async function destinations(workspaceId: string): Promise<Destination[]> {
	const { data, error } = await getSupabaseAdmin()
		.from("workspace_broadcast_destinations")
		.select(`
			id,destination_config,privacy_exclude_prompts_and_outputs,sampling_rate,group_join_operator,
			broadcast_destination_keys(key_id),
			broadcast_destination_rule_groups(match_operator,broadcast_destination_rules(field,condition,value))
		`)
		.eq("workspace_id", workspaceId)
		.eq("destination_id", "otel_collector")
		.eq("enabled", true);
	if (error) throw new Error(`otel_destinations_load_failed:${error.message}`);
	return (data ?? []) as Destination[];
}

async function enqueuePayloads(args: {
	eventId: string;
	workspaceId: string;
	gatewaySelection: GatewayGenAiTelemetry;
	build: (destination: Destination) => unknown;
}) {
	if (String(getBindings().OTEL_EXPORT_ENABLED ?? "true").toLowerCase() === "false") return 0;
	const configured = await destinations(args.workspaceId);
	const rows = configured
		.filter((destination) => selected(destination, args.gatewaySelection, args.eventId))
		.map((destination) => ({
			workspace_id: args.workspaceId,
			destination_id: destination.id,
			event_id: args.eventId,
			payload: args.build(destination),
			status: "pending",
			next_attempt_at: new Date().toISOString(),
		}));
	if (!rows.length) return 0;
	const { error } = await getSupabaseAdmin()
		.from("otel_export_outbox")
		.upsert(rows, { onConflict: "destination_id,event_id", ignoreDuplicates: true });
	if (error) throw new Error(`otel_outbox_enqueue_failed:${error.message}`);
	return rows.length;
}

export async function enqueueGatewayOtlpExport(args: GatewayGenAiTelemetry) {
	return enqueuePayloads({
		eventId: `gateway:${args.requestId}`,
		workspaceId: args.workspaceId,
		gatewaySelection: args,
		build: (destination) => buildGatewayGenAiOtlpPayload(args, buildOptions(destination)),
	});
}

export async function enqueueAsyncGenAiOtlpExport(args: AsyncGenAiTelemetry & {
	keyId?: string | null;
	userId?: string | null;
}) {
	const selection: GatewayGenAiTelemetry = {
		requestId: args.requestId,
		workspaceId: args.workspaceId,
		keyId: args.keyId,
		userId: args.userId,
		endpoint: args.endpoint,
		requestedModel: args.model,
		provider: args.provider,
		providerModel: args.providerModel,
		requestPayload: args.requestPayload,
		responsePayload: args.responsePayload,
		usage: args.usage,
		statusCode: args.statusCode ?? (args.success ? 200 : 500),
		success: args.success,
		errorType: args.errorType,
		totalNanos: args.costNanos,
		currency: args.currency,
		startedAtMs: args.startedAtMs,
		completedAtMs: args.completedAtMs,
		traceContext: args.traceContext,
		sessionId: args.sessionId,
	};
	const identity = args.phase === "turn"
		? args.requestId
		: args.sessionId ?? args.batchId ?? args.requestId;
	return enqueuePayloads({
		eventId: `${args.operation}:${identity}:${args.phase}`,
		workspaceId: args.workspaceId,
		gatewaySelection: selection,
		build: (destination) => buildAsyncGenAiOtlpPayload(args, buildOptions(destination)).payload,
	});
}

function endpoint(config: Record<string, unknown>): URL {
	const traceSpecific = String(config.otlp_traces_endpoint ?? "").trim();
	const base = traceSpecific || String(
		config.otlp_endpoint ?? config.collector_endpoint ?? config.endpoint ?? "",
	).trim();
	if (!base) throw new Error("OTLP endpoint is required");
	const url = new URL(base);
	if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
		throw new Error("OTLP endpoint must use HTTP(S) without URL credentials");
	}
	const host = url.hostname.toLowerCase();
	if (
		!host || host === "localhost" || host.endsWith(".local") ||
		/^(0|10|127|169\.254|192\.168)\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
		host === "::1" || /^(fc|fd|fe80:)/.test(host)
	) throw new Error("Private OTLP endpoints are not allowed");
	if (!traceSpecific && !url.pathname.endsWith("/v1/traces")) {
		url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/traces`;
	}
	return url;
}

function headers(config: Record<string, unknown>): Headers {
	const result = new Headers({
		"Content-Type": "application/json",
		"Accept": "application/json",
		"Accept-Encoding": "gzip",
	});
	if (typeof config.headers_json === "string" && config.headers_json.trim()) {
		const parsed = JSON.parse(config.headers_json);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("OTLP headers must be a JSON object");
		}
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "string" && !["content-length", "host"].includes(key.toLowerCase())) {
				result.set(key, value);
			}
		}
	}
	if (typeof config.auth_header === "string" && !result.has("authorization")) {
		result.set("Authorization", config.auth_header);
	}
	return result;
}

async function boundedResponse(response: Response): Promise<Record<string, any>> {
	if (!response.body) return {};
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_RESPONSE_BYTES) {
				await reader.cancel("otlp_response_too_large");
				throw new Error("OTLP response exceeded 4 MiB");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	if (!total) return {};
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	try {
		return object(JSON.parse(new TextDecoder().decode(bytes)));
	} catch {
		return {};
	}
}

function retryDelayMs(attempts: number, retryAfter: string | null): number {
	if (retryAfter) {
		const seconds = Number(retryAfter);
		if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 3_600_000);
		const date = Date.parse(retryAfter);
		if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), 3_600_000));
	}
	const exponential = Math.min(1_000 * (2 ** Math.max(0, attempts - 1)), 3_600_000);
	const jitter = crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff;
	return Math.round(exponential * (0.5 + jitter * 0.5));
}

export async function deliverGatewayOtlpPayload(
	payload: unknown,
	config: Record<string, unknown>,
	attempts = 1,
) {
	let collectorEndpoint: URL;
	let collectorHeaders: Headers;
	try {
		collectorEndpoint = endpoint(config);
		collectorHeaders = headers(config);
	} catch (error) {
		return {
			delivered: false,
			retryable: false,
			status: null,
			delayMs: 0,
			error: error instanceof Error ? error.message : "Invalid OTLP destination",
		};
	}
	let response: Response;
	try {
		response = await fetch(collectorEndpoint, {
			method: "POST",
			headers: collectorHeaders,
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(15_000),
		});
	} catch (error) {
		return {
			delivered: false,
			retryable: true,
			status: null,
			delayMs: retryDelayMs(attempts, null),
			error: error instanceof Error ? error.message : "OTLP connection failed",
		};
	}
	const body = await boundedResponse(response);
	const partial = object(body.partialSuccess ?? body.partial_success);
	const rejected = finite(partial.rejectedSpans ?? partial.rejected_spans) ?? 0;
	if (response.ok && rejected <= 0) {
		return { delivered: true, retryable: false, status: response.status, delayMs: 0, error: null };
	}
	const partialMessage = String(partial.errorMessage ?? partial.error_message ?? "").slice(0, 1_000);
	return {
		delivered: false,
		retryable: !response.ok && RETRYABLE_STATUS.has(response.status),
		status: response.status,
		delayMs: retryDelayMs(attempts, response.headers.get("retry-after")),
		error: response.ok
			? `OTLP partial success rejected ${rejected} spans${partialMessage ? `: ${partialMessage}` : ""}`
			: `OTLP endpoint returned ${response.status}`,
	};
}

async function updateOutboxRow(
	client: ReturnType<typeof getSupabaseAdmin>,
	id: string,
	patch: Record<string, unknown>,
) {
	const { error } = await client.from("otel_export_outbox").update(patch).eq("id", id);
	if (error) throw new Error(`otel_outbox_update_failed:${error.message}`);
}

export async function drainGatewayOtlpOutbox(limit = 100): Promise<{
	claimed: number;
	delivered: number;
	retried: number;
	failed: number;
}> {
	const client = getSupabaseAdmin();
	const { data, error } = await client.rpc("claim_otel_export_outbox", { p_limit: limit });
	if (error) throw new Error(`otel_outbox_claim_failed:${error.message}`);
	const rows = (data ?? []) as OutboxRow[];
	let delivered = 0;
	let retried = 0;
	let failed = 0;
	for (const row of rows) {
		const destinationResult = await client
			.from("workspace_broadcast_destinations")
			.select("destination_config,enabled")
			.eq("id", row.destination_id)
			.maybeSingle();
		if (destinationResult.error || !destinationResult.data?.enabled) {
			await updateOutboxRow(client, row.id, {
				status: "failed",
				last_error: "OTLP destination unavailable or disabled",
				lease_expires_at: null,
				updated_at: new Date().toISOString(),
			});
			failed += 1;
			continue;
		}
		let outcome;
		try {
			outcome = await deliverGatewayOtlpPayload(
				row.payload,
				object(destinationResult.data.destination_config),
				row.attempts,
			);
		} catch (deliveryError) {
			outcome = {
				delivered: false,
				retryable: false,
				status: null,
				delayMs: 0,
				error: deliveryError instanceof Error ? deliveryError.message : "OTLP delivery failed",
			};
		}
		if (outcome.delivered) {
			await updateOutboxRow(client, row.id, {
				status: "delivered",
				delivered_at: new Date().toISOString(),
				lease_expires_at: null,
				last_http_status: outcome.status,
				last_error: outcome.error,
				updated_at: new Date().toISOString(),
			});
			delivered += 1;
			continue;
		}
		const shouldRetry = outcome.retryable && row.attempts < MAX_ATTEMPTS;
		await updateOutboxRow(client, row.id, {
			status: shouldRetry ? "pending" : "failed",
			next_attempt_at: new Date(Date.now() + outcome.delayMs).toISOString(),
			lease_expires_at: null,
			last_http_status: outcome.status,
			last_error: outcome.error,
			updated_at: new Date().toISOString(),
		});
		if (shouldRetry) retried += 1;
		else failed += 1;
	}
	return { claimed: rows.length, delivered, retried, failed };
}
