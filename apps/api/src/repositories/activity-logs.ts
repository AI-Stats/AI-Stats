import { gatewayRequests } from "@phaseo/db/schema";
import { and, desc, eq, gte, lte } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export type ActivityLogStatusFilter =
	| { kind: "success"; value: boolean }
	| { kind: "status_code"; value: number }
	| { kind: "status_range"; lower: number; upper: number };

export type ActivityLogFilters = {
	workspaceId: string;
	from: string;
	to: string | null;
	provider: string | null;
	model: string | null;
	endpoint: string | null;
	requestId: string | null;
	keyId: string | null;
	sessionId: string | null;
	errorCode: string | null;
	status: ActivityLogStatusFilter | null;
};

const selection = {
	request_id: gatewayRequests.requestId,
	created_at: gatewayRequests.createdAt,
	endpoint: gatewayRequests.endpoint,
	model_id: gatewayRequests.modelId,
	requested_model_id: gatewayRequests.requestedModelId,
	routed_model_id: gatewayRequests.routedModelId,
	canonical_model_id: gatewayRequests.canonicalModelId,
	provider: gatewayRequests.provider,
	status_code: gatewayRequests.statusCode,
	success: gatewayRequests.success,
	error_code: gatewayRequests.errorCode,
	latency_ms: gatewayRequests.latencyMs,
	generation_ms: gatewayRequests.generationMs,
	usage: gatewayRequests.usage,
	cost_nanos: gatewayRequests.costNanos,
	currency: gatewayRequests.currency,
	pricing_lines: gatewayRequests.pricingLines,
	key_id: gatewayRequests.keyId,
	auth_method: gatewayRequests.authMethod,
	oauth_client_id: gatewayRequests.oauthClientId,
	stream: gatewayRequests.stream,
	byok: gatewayRequests.byok,
	native_response_id: gatewayRequests.nativeResponseId,
	throughput: gatewayRequests.throughput,
	location: gatewayRequests.location,
	finish_reason: gatewayRequests.finishReason,
};

function whereFor(filters: ActivityLogFilters) {
	const conditions = [
		eq(gatewayRequests.workspaceId, filters.workspaceId),
		gte(gatewayRequests.createdAt, filters.from),
	];
	if (filters.to) conditions.push(lte(gatewayRequests.createdAt, filters.to));
	if (filters.provider) conditions.push(eq(gatewayRequests.provider, filters.provider));
	if (filters.model) conditions.push(eq(gatewayRequests.modelId, filters.model));
	if (filters.endpoint) conditions.push(eq(gatewayRequests.endpoint, filters.endpoint));
	if (filters.requestId) conditions.push(eq(gatewayRequests.requestId, filters.requestId));
	if (filters.keyId) conditions.push(eq(gatewayRequests.keyId, filters.keyId));
	if (filters.sessionId) conditions.push(eq(gatewayRequests.sessionId, filters.sessionId));
	if (filters.errorCode) conditions.push(eq(gatewayRequests.errorCode, filters.errorCode));
	if (filters.status?.kind === "success") conditions.push(eq(gatewayRequests.success, filters.status.value));
	if (filters.status?.kind === "status_code") conditions.push(eq(gatewayRequests.statusCode, filters.status.value));
	if (filters.status?.kind === "status_range") {
		conditions.push(gte(gatewayRequests.statusCode, filters.status.lower));
		conditions.push(lte(gatewayRequests.statusCode, filters.status.upper));
	}
	return and(...conditions);
}

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function listActivityLogs(filters: ActivityLogFilters, limit: number, offset: number) {
	return withDatabase(async (db) => {
		const where = whereFor(filters);
		const [total, rows] = await Promise.all([
			db.$count(gatewayRequests, where),
			db.select(selection).from(gatewayRequests).where(where)
				.orderBy(desc(gatewayRequests.createdAt)).limit(limit).offset(offset),
		]);
		return { total, rows };
	});
}

export async function findActivityLog(workspaceId: string, requestId: string) {
	return withDatabase(async (db) => (await db.select(selection).from(gatewayRequests).where(and(
		eq(gatewayRequests.workspaceId, workspaceId),
		eq(gatewayRequests.requestId, requestId),
	)).orderBy(desc(gatewayRequests.createdAt)).limit(1))[0] ?? null);
}
