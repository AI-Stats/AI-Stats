import { creditLedger, users, wallets, workspaceInvites, workspaceJoinRequests, workspaceMembers, workspaceSettings, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, gt, gte, inArray, isNull, or, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getTeamsDashboard(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [[profile], memberships, owned] = await Promise.all([
			db.select({ defaultWorkspaceId: users.defaultWorkspaceId }).from(users).where(eq(users.userId, userId)).limit(1),
			db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, userId)),
			db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerUserId, userId)),
		]);
		const accessibleIds = [...new Set([...memberships.map((row) => String(row.workspaceId)), ...owned.map((row) => String(row.id))])];
		if (!accessibleIds.length) return { profile, memberships, owned, teams: [], members: [], invites: [], requests: [], balances: [], settings: [] };
		const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
		const [teams, members, invites, requests, balances, settings] = await Promise.all([
			db.select({ id: workspaces.id, name: workspaces.name, publisherHandle: workspaces.publisherHandle }).from(workspaces).where(inArray(workspaces.id, accessibleIds)),
			db.select({ workspaceId: workspaceMembers.workspaceId, userId: workspaceMembers.userId, role: workspaceMembers.role, displayName: users.displayName }).from(workspaceMembers).leftJoin(users, eq(users.userId, workspaceMembers.userId)).where(inArray(workspaceMembers.workspaceId, accessibleIds)),
			db.select({ invite: workspaceInvites, creatorDisplayName: users.displayName }).from(workspaceInvites).leftJoin(users, eq(users.userId, workspaceInvites.creatorUserId)).where(and(inArray(workspaceInvites.workspaceId, accessibleIds), or(isNull(workspaceInvites.expiresAt), gte(workspaceInvites.expiresAt, sevenDaysAgo)))),
			db.execute<Record<string, unknown>>(sql`select request.*, workspace.name team_name, requester.display_name requester_display_name, decider.display_name decider_display_name from ${workspaceJoinRequests} request join ${workspaces} workspace on workspace.id=request.workspace_id left join ${users} requester on requester.user_id=request.requester_user_id left join ${users} decider on decider.user_id=request.decided_by where request.workspace_id = any(${accessibleIds}::uuid[]) and (request.decided_at is null or request.decided_at>=${sevenDaysAgo}::timestamptz)`),
			db.select({ workspaceId: wallets.workspaceId, balanceNanos: wallets.balanceNanos }).from(wallets).where(inArray(wallets.workspaceId, accessibleIds)),
			db.select().from(workspaceSettings).where(inArray(workspaceSettings.workspaceId, accessibleIds)),
		]);
		return { profile, memberships, owned, teams, members, invites, requests: [...requests], balances, settings };
	} finally { await client.end({ timeout: 1 }); }
}

export async function canCreateWorkspace(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const memberships = await db.select({ workspaceId: workspaceMembers.workspaceId }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, userId), inArray(workspaceMembers.role, ["owner", "admin"])));
		const ids = memberships.map((row) => String(row.workspaceId)); if (!ids.length) return false;
		const [[paid], [enterprise]] = await Promise.all([
			db.select({ count: sql<number>`count(*)::int` }).from(creditLedger).where(and(inArray(creditLedger.workspaceId, ids), inArray(creditLedger.kind, ["top_up", "top_up_one_off", "auto_top_up"]), inArray(creditLedger.status, ["Succeeded", "succeeded", "paid", "Paid"]), gt(creditLedger.amountNanos, 0))),
			db.select({ count: sql<number>`count(*)::int` }).from(workspaces).where(and(inArray(workspaces.id, ids), eq(workspaces.tier, "enterprise"))),
		]);
		return Number(paid?.count ?? 0) > 0 || Number(enterprise?.count ?? 0) > 0;
	} finally { await client.end({ timeout: 1 }); }
}

export async function createWorkspace(env: Env, input: { userId: string; name: string; slug: string }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const [workspace] = await tx.insert(workspaces).values({ name: input.name, slug: input.slug, publisherHandle: input.slug, ownerUserId: input.userId }).returning({ id: workspaces.id });
		if (!workspace) throw new Error("workspace_create_failed");
		await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: input.userId, role: "owner" }).onConflictDoNothing();
		await tx.insert(wallets).values({ workspaceId: workspace.id, stripeCustomerId: "" }).onConflictDoNothing();
		return String(workspace.id);
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function getWorkspaceSso(env: Env, workspaceId: string) { const { db, client } = createDatabase(env); try { const [row] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).limit(1); return row ?? null; } finally { await client.end({ timeout: 1 }); } }
export async function saveWorkspaceSso(env: Env, workspaceId: string, values: Partial<typeof workspaceSettings.$inferInsert>) { const { db, client } = createDatabase(env); try { await db.insert(workspaceSettings).values({ workspaceId, ...values }).onConflictDoUpdate({ target: workspaceSettings.workspaceId, set: values }); } finally { await client.end({ timeout: 1 }); } }

export async function renameWorkspace(env: Env, workspaceId: string, userId: string, name: string) { const { db, client } = createDatabase(env); try { const [profile] = await db.select({ defaultWorkspaceId: users.defaultWorkspaceId }).from(users).where(eq(users.userId, userId)).limit(1); if (String(profile?.defaultWorkspaceId ?? "") === workspaceId) return "personal" as const; await db.update(workspaces).set({ name, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, workspaceId)); return "ok" as const; } finally { await client.end({ timeout: 1 }); } }
export async function removeWorkspace(env: Env, workspaceId: string, userId: string) { const { db, client } = createDatabase(env); try { const [[profile], [workspace]] = await Promise.all([db.select({ defaultWorkspaceId: users.defaultWorkspaceId }).from(users).where(eq(users.userId, userId)).limit(1), db.select({ ownerUserId: workspaces.ownerUserId }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)]); if (String(profile?.defaultWorkspaceId ?? "") === workspaceId) return "personal" as const; if (!workspace) return "not_found" as const; if (String(workspace.ownerUserId) !== userId) return "owner_required" as const; await db.delete(workspaces).where(eq(workspaces.id, workspaceId)); return "ok" as const; } finally { await client.end({ timeout: 1 }); } }

export async function createWorkspaceInvite(env: Env, values: typeof workspaceInvites.$inferInsert) { const { db, client } = createDatabase(env); try { const [row] = await db.insert(workspaceInvites).values(values).returning({ id: workspaceInvites.id }); return row ?? null; } finally { await client.end({ timeout: 1 }); } }
export async function findWorkspaceInvite(env: Env, inviteId: string) { const { db, client } = createDatabase(env); try { const [invite] = await db.select().from(workspaceInvites).where(eq(workspaceInvites.id, inviteId)).limit(1); return invite ?? null; } finally { await client.end({ timeout: 1 }); } }
export async function getMemberRole(env: Env, workspaceId: string, userId: string) { const { db, client } = createDatabase(env); try { const [row] = await db.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).limit(1); return row?.role ?? null; } finally { await client.end({ timeout: 1 }); } }
export async function deleteWorkspaceInvite(env: Env, inviteId: string) { const { db, client } = createDatabase(env); try { const [row] = await db.delete(workspaceInvites).where(eq(workspaceInvites.id, inviteId)).returning({ id: workspaceInvites.id }); return row ?? null; } finally { await client.end({ timeout: 1 }); } }

export async function acceptWorkspaceInvite(env: Env, input: { fingerprint: string; userId: string }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => {
		await tx.execute(sql`select id from ${workspaceInvites} where token_fingerprint=${input.fingerprint} for update`);
		const [invite] = await tx.select().from(workspaceInvites).where(eq(workspaceInvites.tokenFingerprint, input.fingerprint)).limit(1);
		if (!invite || Date.parse(invite.expiresAt) <= Date.now() || (invite.maxUses != null && invite.usesCount >= invite.maxUses)) return { status: "invalid" as const };
		const [[member], [pending]] = await Promise.all([tx.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, invite.workspaceId), eq(workspaceMembers.userId, input.userId))).limit(1), tx.select({ id: workspaceJoinRequests.id }).from(workspaceJoinRequests).where(and(eq(workspaceJoinRequests.workspaceId, invite.workspaceId), eq(workspaceJoinRequests.requesterUserId, input.userId), eq(workspaceJoinRequests.status, "pending"))).limit(1)]);
		if (member) return { status: "member" as const }; if (pending) return { status: "pending" as const };
		const [created] = await tx.insert(workspaceJoinRequests).values({ workspaceId: invite.workspaceId, inviteId: invite.id, requesterUserId: input.userId, status: "pending" }).returning({ id: workspaceJoinRequests.id });
		return { status: "ok" as const, id: created?.id };
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function setWorkspaceMemberRole(env: Env, input: { workspaceId: string; userId: string; role: "admin" | "member" }) { const { db, client } = createDatabase(env); try { const [workspace] = await db.select({ ownerUserId: workspaces.ownerUserId }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1); if (String(workspace?.ownerUserId ?? "") === input.userId) return "owner" as const; await db.insert(workspaceMembers).values(input).onConflictDoUpdate({ target: [workspaceMembers.workspaceId, workspaceMembers.userId], set: { role: input.role } }); return "ok" as const; } finally { await client.end({ timeout: 1 }); } }
export async function removeWorkspaceMember(env: Env, input: { workspaceId: string; userId: string; actorRole: string; isSelf: boolean }) { const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => { await tx.execute(sql`select user_id from ${workspaceMembers} where workspace_id=${input.workspaceId}::uuid and user_id=${input.userId}::uuid for update`); const [[workspace], [member]] = await Promise.all([tx.select({ ownerUserId: workspaces.ownerUserId }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1), tx.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId))).limit(1)]); if (String(workspace?.ownerUserId ?? "") === input.userId) return { status: "owner" as const }; const rank = (role: string | null | undefined) => ({ owner: 1, admin: 2, member: 3 }[String(role ?? "").toLowerCase()] ?? 4); if (!input.isSelf && rank(member?.role) < rank(input.actorRole)) return { status: "higher" as const }; await tx.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId))); return { status: "ok" as const }; }); } finally { await client.end({ timeout: 1 }); } }

export async function decideWorkspaceJoinRequest(env: Env, input: { requestId: string; actorUserId: string; decision: "approve" | "reject" }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => {
		await tx.execute(sql`select id from ${workspaceJoinRequests} where id=${input.requestId}::uuid for update`);
		const [request] = await tx.select().from(workspaceJoinRequests).where(eq(workspaceJoinRequests.id, input.requestId)).limit(1); if (!request || request.status !== "pending") return null;
		const [[workspace], [membership]] = await Promise.all([tx.select({ ownerUserId: workspaces.ownerUserId }).from(workspaces).where(eq(workspaces.id, request.workspaceId)).limit(1), tx.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, request.workspaceId), eq(workspaceMembers.userId, input.actorUserId))).limit(1)]);
		if (String(workspace?.ownerUserId ?? "") !== input.actorUserId && !["owner", "admin"].includes(String(membership?.role ?? ""))) throw new Error("forbidden");
		if (input.decision === "approve") { let role: "owner" | "admin" | "member" = "member"; if (request.inviteId) { const [invite] = await tx.select().from(workspaceInvites).where(and(eq(workspaceInvites.id, request.inviteId), eq(workspaceInvites.workspaceId, request.workspaceId))).limit(1); if (!invite || Date.parse(invite.expiresAt) <= Date.now() || (invite.maxUses != null && invite.usesCount >= invite.maxUses)) throw new Error("invalid_invite"); role = invite.role; await tx.update(workspaceInvites).set({ usesCount: invite.usesCount + 1, updatedAt: new Date().toISOString() }).where(eq(workspaceInvites.id, invite.id)); } await tx.insert(workspaceMembers).values({ workspaceId: request.workspaceId, userId: request.requesterUserId, role }).onConflictDoNothing(); }
		await tx.update(workspaceJoinRequests).set({ status: input.decision === "approve" ? "approved" : "denied", decidedBy: input.actorUserId, decidedAt: new Date().toISOString() }).where(eq(workspaceJoinRequests.id, request.id));
		return { id: request.id, workspaceId: request.workspaceId };
	}); } finally { await client.end({ timeout: 1 }); }
}
