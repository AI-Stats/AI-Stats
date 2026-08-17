import { workspaceMembers, workspaces } from "@phaseo/db/schema";
import { and, eq } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export type WorkspaceAccess = { workspaceId: string; role: "owner" | "admin" | "member" };

export async function getWorkspaceAccess(env: Env, userId: string, workspaceId: string): Promise<WorkspaceAccess | null> {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({ ownerUserId: workspaces.ownerUserId, memberRole: workspaceMembers.role })
			.from(workspaces).leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
			.where(eq(workspaces.id, workspaceId)).limit(1);
		if (!row || (row.ownerUserId !== userId && !row.memberRole)) return null;
		return { workspaceId, role: row.ownerUserId === userId ? "owner" : row.memberRole ?? "member" };
	} finally { await client.end({ timeout: 1 }); }
}

export async function listWorkspaceAccess(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, ownerUserId: workspaces.ownerUserId, memberRole: workspaceMembers.role })
			.from(workspaces).leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)));
		return rows.filter((row) => row.ownerUserId === userId || row.memberRole).map((row) => ({ id: row.id, name: row.name, slug: row.slug, role: row.ownerUserId === userId ? "owner" as const : row.memberRole ?? "member" as const }));
	} finally { await client.end({ timeout: 1 }); }
}

export async function getWorkspaceName(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({ name: workspaces.name }).from(workspaces)
			.where(eq(workspaces.id, workspaceId)).limit(1);
		return row?.name ?? null;
	} finally { await client.end({ timeout: 1 }); }
}
