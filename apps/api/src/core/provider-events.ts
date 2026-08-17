// Purpose: Persist provider webhook events for idempotency and auditability.
// Why: Provider webhooks may be delivered multiple times and retried.
// How: Writes one row per provider event id through a transactional Drizzle repository.

import * as providerEventRepository from "@/repositories/provider-events";

export type ProviderEventRecord = {
	id: string;
	provider: string;
	providerEventId: string;
	kind: string | null;
	workspaceId: string | null;
	internalId: string | null;
	payload: Record<string, unknown>;
	processedAt: string | null;
	attemptCount: number;
	nextAttemptAt: string | null;
	createdAt: string | null;
};

type ProviderEventRow = {
	id: string;
	provider: string;
	provider_event_id: string;
	kind: string | null;
	workspace_id: string | null;
	internal_id: string | null;
	payload: Record<string, unknown> | null;
	processed_at: string | null;
	attempt_count?: number | null;
	next_attempt_at?: string | null;
	created_at: string | null;
};

function normalizeText(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function mapRow(row: ProviderEventRow): ProviderEventRecord {
	return {
		id: row.id,
		provider: row.provider,
		providerEventId: row.provider_event_id,
		kind: row.kind,
		workspaceId: row.workspace_id,
		internalId: row.internal_id,
		payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {},
		processedAt: row.processed_at,
		attemptCount: Math.max(0, Number(row.attempt_count ?? 0) || 0),
		nextAttemptAt: row.next_attempt_at ?? null,
		createdAt: row.created_at,
	};
}

export async function insertProviderEvent(args: {
	provider: string;
	providerEventId: string;
	kind?: string | null;
	workspaceId?: string | null;
	internalId?: string | null;
	payload?: Record<string, unknown> | null;
	headers?: Record<string, string> | null;
}): Promise<{ inserted: boolean; record: ProviderEventRecord | null }> {
	const provider = normalizeText(args.provider);
	const providerEventId = normalizeText(args.providerEventId);
	if (!provider || !providerEventId) {
		return { inserted: false, record: null };
	}

	const now = new Date().toISOString();
	const payload = {
		provider,
		providerEventId,
		kind: normalizeText(args.kind),
		workspaceId: normalizeText(args.workspaceId),
		internalId: normalizeText(args.internalId),
		payload: args.payload ?? {},
		headers: args.headers ?? {},
		updatedAt: now,
	};

	const data = await providerEventRepository.insertProviderEvent(payload);
	if (data) {
		return {
			inserted: true,
			record: mapRow(data as ProviderEventRow),
		};
	}
	return { inserted: false, record: await getProviderEvent(provider, providerEventId) };
}

export async function getProviderEvent(
	providerRaw: string,
	providerEventIdRaw: string,
): Promise<ProviderEventRecord | null> {
	const provider = normalizeText(providerRaw);
	const providerEventId = normalizeText(providerEventIdRaw);
	if (!provider || !providerEventId) return null;

	const data = await providerEventRepository.findProviderEvent(provider, providerEventId);
	if (!data) return null;
	return mapRow(data as ProviderEventRow);
}

export async function listUnprocessedProviderEvents(args: {
	providers: string[];
	limit?: number;
	workerId?: string;
	leaseSeconds?: number;
}): Promise<ProviderEventRecord[]> {
	const providers = [...new Set(args.providers.map((provider) => normalizeText(provider)).filter((provider): provider is string => Boolean(provider)))];
	if (providers.length === 0) return [];
	const limit = Math.max(1, Math.min(500, Math.trunc(args.limit ?? 100)));
	const data = await providerEventRepository.claimProviderEvents({ providers, limit, workerId: normalizeText(args.workerId) ?? "batch-provider-event-replay", leaseSeconds: Math.max(30, Math.min(3_600, Math.trunc(args.leaseSeconds ?? 120))) });
	return (data ?? []).map((row) => mapRow(row as ProviderEventRow));
}

export async function claimProviderEvent(args: {
	provider: string;
	providerEventId: string;
	workerId?: string;
	leaseSeconds?: number;
}): Promise<boolean> {
	const provider = normalizeText(args.provider);
	const providerEventId = normalizeText(args.providerEventId);
	if (!provider || !providerEventId) return false;
	return providerEventRepository.claimProviderEvent({ provider, providerEventId, workerId: normalizeText(args.workerId) ?? "batch-provider-webhook", leaseSeconds: Math.max(30, Math.min(3_600, Math.trunc(args.leaseSeconds ?? 120))) });
}

export async function deferProviderEvent(args: {
	provider: string;
	providerEventId: string;
	reason: string;
}): Promise<void> {
	const provider = normalizeText(args.provider);
	const providerEventId = normalizeText(args.providerEventId);
	if (!provider || !providerEventId) return;
	await providerEventRepository.deferProviderEvent(provider, providerEventId, normalizeText(args.reason) ?? "provider_event_deferred");
}

export async function markProviderEventProcessed(args: {
	provider: string;
	providerEventId: string;
	workspaceId?: string | null;
	internalId?: string | null;
}): Promise<void> {
	const provider = normalizeText(args.provider);
	const providerEventId = normalizeText(args.providerEventId);
	if (!provider || !providerEventId) return;

	const workspaceId = normalizeText(args.workspaceId);
	const internalId = normalizeText(args.internalId);
	await providerEventRepository.markProviderEventProcessed({ provider, providerEventId, workspaceId, internalId });
}
