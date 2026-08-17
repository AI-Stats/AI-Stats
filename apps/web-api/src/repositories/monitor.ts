import { monitorHistoryEvents, monitorHistorySyncState, v2Models, v2Providers } from "@phaseo/db/schema";
import { and, asc, desc, eq, inArray, sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export type MonitorFilters = { changeType: string | null; limit: number; offset: number; model: string | null; provider: string | null };

function condition(input: MonitorFilters) {
	const values = [];
	if (input.model) values.push(eq(monitorHistoryEvents.modelId, input.model));
	if (input.provider) values.push(eq(monitorHistoryEvents.providerSlug, input.provider));
	if (input.changeType) values.push(eq(monitorHistoryEvents.changeKind, input.changeType));
	return values.length ? and(...values) : undefined;
}

export async function getMonitorHistory(env: Env, input: MonitorFilters) {
	const { db, client } = createDatabase(env);
	try {
		const where = condition(input);
		const [counts, state, commitRows] = await Promise.all([
			db.select({ total_changes: sql<number>`count(*)::int`, total_commits: sql<number>`count(distinct ${monitorHistoryEvents.commitSha})::int` }).from(monitorHistoryEvents).where(where),
			db.select({ generated_at: monitorHistorySyncState.generatedAt, last_sha: monitorHistorySyncState.lastSha, source_base: monitorHistorySyncState.sourceBase, source_head: monitorHistorySyncState.sourceHead }).from(monitorHistorySyncState).where(eq(monitorHistorySyncState.syncKey, "catalog")).limit(1),
			db.select({ commitSha: monitorHistoryEvents.commitSha, committedAt: sql<string>`max(${monitorHistoryEvents.committedAt})` }).from(monitorHistoryEvents).where(where).groupBy(monitorHistoryEvents.commitSha).orderBy(sql`max(${monitorHistoryEvents.committedAt}) desc`, sql`${monitorHistoryEvents.commitSha} desc`).limit(input.limit).offset(input.offset),
		]);
		const commitShas = commitRows.map((row) => row.commitSha);
		const rows = commitShas.length ? await db.select().from(monitorHistoryEvents).where(inArray(monitorHistoryEvents.commitSha, commitShas))
			.orderBy(desc(monitorHistoryEvents.committedAt), sql`lower(coalesce(${monitorHistoryEvents.orgId}, ''))`, sql`lower(coalesce(${monitorHistoryEvents.modelId}, ''))`, sql`case coalesce(${monitorHistoryEvents.action}, '') when 'added' then 0 when 'changed' then 1 when 'removed' then 2 else 3 end`, asc(monitorHistoryEvents.eventId)) : [];
		return { rows: rows.map((row) => ({ event_id: row.eventId, committed_at: row.committedAt, provider_kind: row.providerKind, model_id: row.modelId, endpoint: row.endpoint, field: row.field, old_value: row.oldValue, new_value: row.newValue, percent_change: row.percentChange, action: row.action, commit_sha: row.commitSha, entity_id: row.entityId, entity_type: row.entityType, org_id: row.orgId })), summary: { ...(counts[0] ?? { total_changes: 0, total_commits: 0 }), ...(state[0] ?? {}) } };
	} finally { await client.end({ timeout: 1 }); }
}

export async function listMonitorFilterOptions(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const [models, providers] = await Promise.all([
			db.select({ option_value: v2Models.modelSlug, option_label: v2Models.name }).from(v2Models).where(eq(v2Models.hidden, false)).orderBy(asc(v2Models.name), asc(v2Models.modelSlug)),
			db.select({ option_value: v2Providers.providerSlug, option_label: v2Providers.name }).from(v2Providers).orderBy(asc(v2Providers.name), asc(v2Providers.providerSlug)),
		]);
		return [...models.filter((row) => row.option_value?.trim()).map((row) => ({ ...row, option_kind: "model" })), ...providers.filter((row) => row.option_value?.trim()).map((row) => ({ ...row, option_kind: "provider" }))];
	} finally { await client.end({ timeout: 1 }); }
}
