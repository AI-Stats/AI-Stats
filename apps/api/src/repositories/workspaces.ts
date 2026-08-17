import { keys, managementKeys, users, workspaceMembers, workspaceSettings, workspaces } from "@phaseo/db/schema";
import { and, eq, inArray, ne } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const workspaceSelection = {
	id: workspaces.id,
	name: workspaces.name,
	slug: workspaces.slug,
	owner_user_id: workspaces.ownerUserId,
	created_at: workspaces.createdAt,
	updated_at: workspaces.updatedAt,
};

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

function publisherHandle(slug: string, workspaceId: string): string {
	if (slug.length <= 40) return slug;
	return `${slug.slice(0, 31).replace(/-+$/, "")}-${workspaceId.slice(0, 8)}`;
}

export async function findWorkspaceById(workspaceId: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select(workspaceSelection).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
		return row ?? null;
	});
}

export async function isDefaultWorkspaceForUser(userId: string, workspaceId: string): Promise<boolean> {
	return withDatabase(async (db) => {
		const [row] = await db.select({ defaultWorkspaceId: users.defaultWorkspaceId }).from(users).where(eq(users.userId, userId)).limit(1);
		return row?.defaultWorkspaceId === workspaceId;
	});
}

export async function createWorkspaceWithOwner(args: { name: string; slug: string; ownerUserId: string }) {
	return withDatabase(async (db) => db.transaction(async (tx) => {
		const id = crypto.randomUUID();
		const [workspace] = await tx.insert(workspaces).values({
			id,
			name: args.name,
			slug: args.slug,
			ownerUserId: args.ownerUserId,
			publisherHandle: publisherHandle(args.slug, id),
		}).returning(workspaceSelection);
		if (!workspace) throw new Error("Workspace creation returned no row");
		await tx.insert(workspaceMembers).values({ workspaceId: id, userId: args.ownerUserId, role: "owner" })
			.onConflictDoNothing({ target: [workspaceMembers.workspaceId, workspaceMembers.userId] });
		await tx.insert(workspaceSettings).values({ workspaceId: id, routingMode: "balanced" })
			.onConflictDoNothing({ target: workspaceSettings.workspaceId });
		return workspace;
	}));
}

export async function deleteWorkspaceByOwner(workspaceId: string, ownerUserId: string): Promise<boolean> {
	return withDatabase(async (db) => db.transaction(async (tx) => {
		const [owned] = await tx.select({ id: workspaces.id }).from(workspaces)
			.where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerUserId, ownerUserId))).limit(1);
		if (!owned) return false;
		await tx.delete(managementKeys).where(eq(managementKeys.workspaceId, workspaceId));
		const rows = await tx.delete(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerUserId, ownerUserId))).returning({ id: workspaces.id });
		return rows.length > 0;
	}));
}

export async function updateWorkspaceByOwner(workspaceId: string, ownerUserId: string, patch: { name?: string; slug?: string }) {
	return withDatabase(async (db) => {
		const [row] = await db.update(workspaces).set({ ...patch, updatedAt: new Date().toISOString() })
			.where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerUserId, ownerUserId)))
			.returning(workspaceSelection);
		return row ?? null;
	});
}

export async function countActiveWorkspaceKeys(workspaceId: string): Promise<number> {
	return withDatabase((db) => db.$count(keys, and(eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted"))));
}

export async function findExistingUserIds(userIds: string[]): Promise<Set<string>> {
	if (!userIds.length) return new Set();
	return withDatabase(async (db) => {
		const rows = await db.select({ userId: users.userId }).from(users).where(inArray(users.userId, userIds));
		return new Set(rows.map(({ userId }) => userId));
	});
}

export async function upsertWorkspaceMembers(workspaceId: string, userIds: string[], role: "admin" | "member"): Promise<void> {
	if (!userIds.length) return;
	await withDatabase(async (db) => {
		await db.insert(workspaceMembers).values(userIds.map((userId) => ({ workspaceId, userId, role })))
			.onConflictDoUpdate({
				target: [workspaceMembers.workspaceId, workspaceMembers.userId],
				set: { role },
			});
	});
}

export async function findWorkspaceMemberRoles(workspaceId: string, userIds: string[]) {
	if (!userIds.length) return [];
	return withDatabase((db) => db.select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
		.from(workspaceMembers)
		.where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.userId, userIds))));
}

export async function removeWorkspaceMembers(workspaceId: string, userIds: string[]): Promise<number> {
	if (!userIds.length) return 0;
	return withDatabase(async (db) => {
		const removed = await db.delete(workspaceMembers)
			.where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.userId, userIds)))
			.returning({ userId: workspaceMembers.userId });
		return removed.length;
	});
}
