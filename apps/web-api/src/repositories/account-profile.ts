import { catalogueGameResults, gatewayRequests, presets, twoFactor, users, v2Models, workspaceMembers, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, inArray, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getProfileRecord(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({ profile: users, workspaceName: workspaces.name }).from(users).leftJoin(workspaces, eq(workspaces.id, users.defaultWorkspaceId)).where(eq(users.userId, userId)).limit(1);
		return row ?? null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function listProfileWorkspaceIds(env: Env, userId: string, limit: number) {
	const { db, client } = createDatabase(env);
	try {
		const memberRows = await db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).limit(limit);
		const ownedRows = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerUserId, userId)).limit(limit);
		return [...new Set([...memberRows, ...ownedRows].map((row) => row.id))].slice(0, limit);
	} finally { await client.end({ timeout: 1 }); }
}

export async function listProfileUsageRows(env: Env, workspaceIds: string[], days: number) {
	if (!workspaceIds.length) return [];
	const { db, client } = createDatabase(env);
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			select date_trunc('day',created_at) bucket,coalesce(nullif(canonical_model_id,''),nullif(routed_model_id,''),model_id,'unknown') model_id,
				count(*)::bigint requests,sum(coalesce(usage_total_tokens,0))::bigint tokens,sum(coalesce(cost_nanos,0))::numeric/1000000000 cost
			from ${gatewayRequests} where workspace_id in (${sql.join(workspaceIds.map((id) => sql`${id}::uuid`),sql`, `)})
				and created_at>=now()-(${days}*interval '1 day') group by 1,2 order by 1 desc
		`);
		return [...result];
	} finally { await client.end({ timeout: 1 }); }
}

export async function getProfileModelNames(env: Env, modelIds: string[]) {
	if (!modelIds.length) return new Map<string, string>();
	const { db, client } = createDatabase(env);
	try { return new Map((await db.select({ id: v2Models.modelSlug, name: v2Models.name }).from(v2Models).where(inArray(v2Models.modelSlug, modelIds))).map((row) => [row.id, row.name])); }
	finally { await client.end({ timeout: 1 }); }
}

export async function listProfileGameResults(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try { return await db.select({ game_key: catalogueGameResults.gameKey, puzzle_date: catalogueGameResults.puzzleDate, won: catalogueGameResults.won, score: catalogueGameResults.score, max_score: catalogueGameResults.maxScore, completed_at: catalogueGameResults.completedAt }).from(catalogueGameResults).where(eq(catalogueGameResults.userId, userId)).orderBy(desc(catalogueGameResults.puzzleDate)).limit(500); }
	finally { await client.end({ timeout: 1 }); }
}

export async function hasPublicPreset(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.select({ id: presets.id }).from(presets).where(and(eq(presets.createdBy, userId), eq(presets.visibility, "public"))).limit(1); return Boolean(row); }
	finally { await client.end({ timeout: 1 }); }
}

export async function saveProfileRecord(env: Env, userId: string, values: Partial<{ displayName: string | null; defaultWorkspaceId: string | null; obfuscateInfo: boolean; publicProfileSlug: string; publicProfileEnabled: boolean }>) {
	const { db, client } = createDatabase(env);
	try {
		await db.insert(users).values({ userId, ...values }).onConflictDoUpdate({ target: users.userId, set: { ...values, updatedAt: new Date().toISOString() } });
	} finally { await client.end({ timeout: 1 }); }
}

export async function hasBetterAuthBackupCodes(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.select({ backupCodes: twoFactor.backupCodes }).from(twoFactor).where(eq(twoFactor.userId, userId)).limit(1); return Boolean(row?.backupCodes); }
	finally { await client.end({ timeout: 1 }); }
}
