import { oauthAppMetadata, oauthClients, users, workspaceMembers, workspaces } from "@phaseo/db/schema";
import { and, asc, eq, inArray, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getAccountProfile(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.select().from(users).where(eq(users.userId, userId)).limit(1); return row ?? null; }
	finally { await client.end({ timeout: 1 }); }
}

export async function saveAccountBetaProfile(env: Env, userId: string, values: { betaOptIn: boolean; betaFeatures: Record<string, boolean> }) {
	const { db, client } = createDatabase(env);
	try {
		await db.insert(users).values({ userId, betaOptIn: values.betaOptIn, betaFeatures: values.betaFeatures })
			.onConflictDoUpdate({ target: users.userId, set: { betaOptIn: values.betaOptIn, betaFeatures: values.betaFeatures, updatedAt: new Date().toISOString() } });
	} finally { await client.end({ timeout: 1 }); }
}

export async function listAccountWorkspaces(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, ownerUserId: workspaces.ownerUserId, memberRole: workspaceMembers.role })
			.from(workspaces).leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId))).orderBy(asc(workspaces.id));
		return rows.filter((row) => row.ownerUserId === userId || row.memberRole).map((row) => ({ id: row.id, name: row.name, slug: row.slug, role: row.ownerUserId === userId ? "owner" : row.memberRole ?? "member" }));
	} finally { await client.end({ timeout: 1 }); }
}

export async function setDefaultWorkspace(env: Env, userId: string, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try { await db.update(users).set({ defaultWorkspaceId: workspaceId, updatedAt: new Date().toISOString() }).where(eq(users.userId, userId)); }
	finally { await client.end({ timeout: 1 }); }
}

export async function updateOnboardingProfile(env: Env, userId: string, values: { onboardingState: Record<string, unknown>; onboardingCompletedAt?: string; declaredCountryCode?: string; countryDeclaredAt?: string }) {
	const { db, client } = createDatabase(env);
	try {
		await db.update(users).set({ onboardingState: values.onboardingState, ...(values.onboardingCompletedAt ? { onboardingCompletedAt: values.onboardingCompletedAt } : {}), ...(values.declaredCountryCode ? { declaredCountryCode: values.declaredCountryCode, countryDeclaredAt: values.countryDeclaredAt } : {}), updatedAt: new Date().toISOString() }).where(eq(users.userId, userId));
	} finally { await client.end({ timeout: 1 }); }
}

export async function listAllWorkspaces(env: Env, workspaceIds?: string[]) {
	const { db, client } = createDatabase(env);
	try { return await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(workspaceIds?.length ? inArray(workspaces.id, workspaceIds) : sql`true`).orderBy(asc(workspaces.name)); }
	finally { await client.end({ timeout: 1 }); }
}

export async function getOAuthConsentContext(env: Env, userId: string, clientId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [appRows, clientRows, memberships] = await Promise.all([
			clientId ? db.select().from(oauthAppMetadata).where(and(eq(oauthAppMetadata.clientId, clientId), eq(oauthAppMetadata.status, "active"))).limit(1) : [],
			clientId ? db.select().from(oauthClients).where(and(eq(oauthClients.id, clientId), eq(oauthClients.status, "active"))).limit(1) : [],
			listAccountWorkspacesWithDb(db, userId),
		]);
		return { appMetadata: appRows[0] ?? null, firstPartyClient: clientRows[0] ?? null, workspaces: memberships.map((workspace) => ({ id: workspace.id, name: workspace.name })) };
	} finally { await client.end({ timeout: 1 }); }
}

async function listAccountWorkspacesWithDb(db: ReturnType<typeof createDatabase>["db"], userId: string) {
	const rows = await db.select({ id: workspaces.id, name: workspaces.name, ownerUserId: workspaces.ownerUserId, memberRole: workspaceMembers.role }).from(workspaces).leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)));
	return rows.filter((row) => row.ownerUserId === userId || row.memberRole);
}

export async function validateOAuthConsentSelection(env: Env, userId: string, clientId: string, workspaceIds: string[]) {
	const { db, client } = createDatabase(env);
	try {
		const accessible = await listAccountWorkspacesWithDb(db, userId);
		if (!workspaceIds.every((id) => accessible.some((workspace) => workspace.id === id))) return { allowed: false, appFound: false };
		if (clientId === "phaseo_cli") return { allowed: true, appFound: true };
		const [app] = await db.select({ id: oauthAppMetadata.id }).from(oauthAppMetadata).where(and(eq(oauthAppMetadata.clientId, clientId), eq(oauthAppMetadata.status, "active"))).limit(1);
		return { allowed: true, appFound: Boolean(app) };
	} finally { await client.end({ timeout: 1 }); }
}
