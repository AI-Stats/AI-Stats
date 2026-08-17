import {
	findBatchRequestRows,
	type BatchRequestInsert,
	type BatchRequestRecord,
	upsertBatchRequestRows,
} from "@/repositories/batch-requests";

export type BatchRequestStatus =
	| "queued"
	| "validating"
	| "in_progress"
	| "completed"
	| "failed"
	| "cancelled"
	| "expired";

export type BatchRequestRowInput = {
	provider: string;
	nativeBatchId?: string | null;
	customId: string;
	requestIndex: number;
	method?: string | null;
	endpoint?: string | null;
	model?: string | null;
	status?: BatchRequestStatus | string | null;
	requestBodyHash?: string | null;
	responseStatus?: number | null;
	responseBody?: Record<string, unknown> | null;
	errorBody?: Record<string, unknown> | null;
	usage?: Record<string, unknown> | null;
	costNanos?: number | null;
	costUsd?: number | null;
	meta?: Record<string, unknown> | null;
	completedAt?: string | null;
};

export type BatchRequestRow = {
	id: string;
	workspaceId: string;
	batchId: string;
	provider: string;
	nativeBatchId: string | null;
	customId: string;
	requestIndex: number;
	method: string | null;
	endpoint: string | null;
	model: string | null;
	status: string;
	requestBodyHash: string | null;
	responseStatus: number | null;
	responseBody: Record<string, unknown> | null;
	errorBody: Record<string, unknown> | null;
	usage: Record<string, unknown> | null;
	costNanos: number | null;
	costUsd: number | null;
	meta: Record<string, unknown>;
	createdAt: string | null;
	updatedAt: string | null;
	completedAt: string | null;
};

function normalizeText(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toPlainObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function toDbRow(workspaceId: string, batchId: string, row: BatchRequestRowInput): BatchRequestInsert {
	return {
		workspaceId,
		batchId,
		provider: row.provider,
		nativeBatchId: row.nativeBatchId ?? null,
		customId: row.customId,
		requestIndex: row.requestIndex,
		method: row.method ?? null,
		endpoint: row.endpoint ?? null,
		model: row.model ?? null,
		status: row.status ?? "queued",
		requestBodyHash: row.requestBodyHash ?? null,
		responseStatus: row.responseStatus ?? null,
		responseBody: row.responseBody ?? null,
		errorBody: row.errorBody ?? null,
		usage: row.usage ?? null,
		costNanos: row.costNanos ?? null,
		costUsd: row.costUsd === null || row.costUsd === undefined ? null : String(row.costUsd),
		meta: row.meta ?? {},
		completedAt: row.completedAt ?? null,
	};
}

function fromDbRow(row: BatchRequestRecord): BatchRequestRow {
	return {
		id: row.id,
		workspaceId: row.workspaceId,
		batchId: row.batchId,
		provider: row.provider,
		nativeBatchId: normalizeText(row.nativeBatchId),
		customId: row.customId,
		requestIndex: row.requestIndex,
		method: normalizeText(row.method),
		endpoint: normalizeText(row.endpoint),
		model: normalizeText(row.model),
		status: String(row.status ?? "queued"),
		requestBodyHash: normalizeText(row.requestBodyHash),
		responseStatus: row.responseStatus,
		responseBody: toPlainObject(row.responseBody),
		errorBody: toPlainObject(row.errorBody),
		usage: toPlainObject(row.usage),
		costNanos: row.costNanos,
		costUsd: row.costUsd === null ? null : Number(row.costUsd),
		meta: toPlainObject(row.meta) ?? {},
		createdAt: normalizeText(row.createdAt),
		updatedAt: normalizeText(row.updatedAt),
		completedAt: normalizeText(row.completedAt),
	};
}

export async function hashBatchRequestBody(value: unknown): Promise<string> {
	const body = JSON.stringify(value ?? null);
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
	return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function saveBatchRequestRows(args: {
	workspaceId: string;
	batchId: string;
	rows: BatchRequestRowInput[];
}): Promise<void> {
	if (!args.workspaceId || !args.batchId || args.rows.length === 0) return;
	const payload = args.rows.map((row) => toDbRow(args.workspaceId, args.batchId, row));
	await upsertBatchRequestRows(payload);
}

export async function listBatchRequestRows(args: {
	workspaceId: string;
	batchId: string;
	limit?: number;
	offset?: number;
	status?: string | null;
}): Promise<BatchRequestRow[]> {
	if (!args.workspaceId || !args.batchId) return [];
	const limit = Math.max(1, Math.min(1000, Math.trunc(args.limit ?? 100)));
	const offset = Math.max(0, Math.trunc(args.offset ?? 0));
	const status = normalizeText(args.status);
	const rows = await findBatchRequestRows({
		workspaceId: args.workspaceId,
		batchId: args.batchId,
		limit,
		offset,
		status,
	});
	return rows.map(fromDbRow);
}
