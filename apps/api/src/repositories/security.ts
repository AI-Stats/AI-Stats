import { emailOutbox, keys, managementKeys, securityKeyReports, workspaceMembers, workspaces } from "@phaseo/db/schema";
import { and, eq, inArray } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

const keyFields = {
	id: keys.id, workspace_id: keys.workspaceId, name: keys.name, prefix: keys.prefix,
	status: keys.status, hash: keys.hash, kid: keys.kid, soft_blocked: keys.softBlocked,
	revoked_at: keys.revokedAt, revoked_reason: keys.revokedReason,
};

export async function loadSecurityKeyCandidates(table: "keys" | "management_keys", kid: string) {
	return withDatabase(async (db) => table === "keys"
		? db.select(keyFields).from(keys).where(eq(keys.kid, kid))
		: db.select({
			id: managementKeys.id, workspace_id: managementKeys.workspaceId, name: managementKeys.name,
			prefix: managementKeys.prefix, status: managementKeys.status, hash: managementKeys.hash,
			kid: managementKeys.kid, soft_blocked: managementKeys.softBlocked,
			revoked_at: managementKeys.revokedAt, revoked_reason: managementKeys.revokedReason,
		}).from(managementKeys).where(eq(managementKeys.kid, kid)));
}

export async function revokeSecurityKey(table: "keys" | "management_keys", id: string, workspaceId: string, revokedAt: string): Promise<void> {
	await withDatabase(async (db) => {
		if (table === "keys") {
			await db.update(keys).set({ status: "compromised", softBlocked: true, revokedAt, revokedReason: "public_leak_report" })
				.where(and(eq(keys.id, id), eq(keys.workspaceId, workspaceId)));
		} else {
			await db.update(managementKeys).set({ status: "compromised", softBlocked: true, revokedAt, revokedReason: "public_leak_report" })
				.where(and(eq(managementKeys.id, id), eq(managementKeys.workspaceId, workspaceId)));
		}
	});
}

export async function loadSecurityNotificationRecipients(workspaceId: string) {
	return withDatabase(async (db) => {
		const [workspace] = await db.select({ name: workspaces.name, ownerUserId: workspaces.ownerUserId })
			.from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
		const members = await db.select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
			.from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.role, ["owner", "admin"])));
		return { workspace: workspace ?? null, members };
	});
}

export async function insertSecurityEmails(rows: Array<typeof emailOutbox.$inferInsert>): Promise<void> {
	if (!rows.length) return;
	await withDatabase(async (db) => { await db.insert(emailOutbox).values(rows); });
}

export async function insertSecurityReport(payload: Record<string, unknown>): Promise<void> {
	await withDatabase(async (db) => {
		await db.insert(securityKeyReports).values({
			status: String(payload.status ?? "received"), source: payload.source as string | null,
			reporterEmail: payload.reporter_email as string | null, evidenceUrl: payload.evidence_url as string | null,
			comment: payload.comment as string | null, tokenPrefix: payload.token_prefix as string | null,
			tokenLastFour: payload.token_last_four as string | null, tokenFingerprint: payload.token_fingerprint as string | null,
			matched: Boolean(payload.matched), keyTable: payload.key_table as string | null,
			apiKeyId: payload.api_key_id as string | null, workspaceId: payload.workspace_id as string | null,
			actionTaken: payload.action_taken as string | null, actionTakenAt: payload.action_taken_at as string | null,
			actionTakenBy: payload.action_taken_by as string | null, reportMode: payload.report_mode as string | null,
			ipHash: payload.ip_hash as string | null, userAgentHash: payload.user_agent_hash as string | null,
		});
	});
}
