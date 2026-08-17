import { keyGuardrails, keys, users, workspaceMemberGuardrails, workspaceMembers, workspaces } from "@phaseo/db/schema";
import { and, asc, eq } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function listGuardrailKeyAssignments(workspaceId: string, guardrailId: string) {
	return withDatabase(async (db) => db.select({
		key_id: keys.id,
		name: keys.name,
		prefix: keys.prefix,
		status: keys.status,
		created_at: keys.createdAt,
	}).from(keyGuardrails)
		.innerJoin(keys, eq(keys.id, keyGuardrails.keyId))
		.where(and(eq(keyGuardrails.guardrailId, guardrailId), eq(keys.workspaceId, workspaceId))));
}

export async function listGuardrailMemberAssignments(workspaceId: string, guardrailId: string) {
	return withDatabase(async (db) => db.select({
		user_id: workspaceMembers.userId,
		role: workspaceMembers.role,
		display_name: users.displayName,
		joined_at: workspaceMembers.joinedAt,
	}).from(workspaceMemberGuardrails)
		.innerJoin(workspaceMembers, and(
			eq(workspaceMembers.workspaceId, workspaceMemberGuardrails.workspaceId),
			eq(workspaceMembers.userId, workspaceMemberGuardrails.userId),
		))
		.leftJoin(users, eq(users.userId, workspaceMembers.userId))
		.where(and(
			eq(workspaceMemberGuardrails.workspaceId, workspaceId),
			eq(workspaceMemberGuardrails.guardrailId, guardrailId),
		)));
}

export async function listWorkspaceMembers(workspaceId: string) {
	return withDatabase(async (db) => db.select({
		workspace_id: workspaceMembers.workspaceId,
		user_id: workspaceMembers.userId,
		role: workspaceMembers.role,
		joined_at: workspaceMembers.joinedAt,
		display_name: users.displayName,
	}).from(workspaceMembers)
		.leftJoin(users, eq(users.userId, workspaceMembers.userId))
		.where(eq(workspaceMembers.workspaceId, workspaceId))
		.orderBy(asc(workspaceMembers.joinedAt)));
}

export async function listUserWorkspaces(userId: string) {
	return withDatabase(async (db) => db.select({
		id: workspaces.id,
		name: workspaces.name,
		slug: workspaces.slug,
		role: workspaceMembers.role,
	}).from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
		.where(eq(workspaceMembers.userId, userId))
		.orderBy(asc(workspaces.name)));
}
