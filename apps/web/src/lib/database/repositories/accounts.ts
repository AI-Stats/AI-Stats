import "server-only";

import { users } from "@phaseo/db/account-schema";
import { workspaceMembers, workspaceSettings, workspaces } from "@phaseo/db/billing-schema";
import { and, asc, eq, ilike, isNull } from "@phaseo/db/query";

import { getDatabase } from "../drizzle";

export async function updateUserDeclaredCountry(
	userId: string,
	countryCode: string,
	declaredAt = new Date()
): Promise<void> {
	await getDatabase().update(users).set({
		declaredCountryCode: countryCode,
		countryDeclaredAt: declaredAt.toISOString(),
	}).where(eq(users.userId, userId));
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
	const row = (await getDatabase().select({ completedAt: users.onboardingCompletedAt })
		.from(users).where(eq(users.userId, userId)).limit(1))[0];
	return Boolean(row?.completedAt);
}

async function ensureWorkspaceDependencies(
	database: ReturnType<typeof getDatabase>,
	workspaceId: string,
	userId: string
) {
	await database.insert(workspaceMembers).values({
		workspaceId,
		userId,
		role: "owner",
	}).onConflictDoNothing();
	await database.insert(workspaceSettings).values({ workspaceId }).onConflictDoNothing();
}

async function findAccessibleWorkspace(
	database: ReturnType<typeof getDatabase>,
	workspaceId: string,
	userId: string
) {
	const membership = (await database.select({ id: workspaceMembers.workspaceId })
		.from(workspaceMembers).where(and(
			eq(workspaceMembers.workspaceId, workspaceId),
			eq(workspaceMembers.userId, userId),
		)).limit(1))[0];
	if (membership) return true;
	const owned = (await database.select({ id: workspaces.id }).from(workspaces).where(and(
		eq(workspaces.id, workspaceId),
		eq(workspaces.ownerUserId, userId),
	)).limit(1))[0];
	if (!owned) return false;
	await ensureWorkspaceDependencies(database, workspaceId, userId);
	return true;
}

export async function provisionPersonalWorkspace(args: {
	userId: string;
	displayName: string;
	baseSlug: string;
}): Promise<{ workspaceId: string; createdPersonalTeam: boolean }> {
	const database = getDatabase();
	await database.insert(users).values({
		userId: args.userId,
		displayName: args.displayName,
	}).onConflictDoUpdate({
		target: users.userId,
		set: { displayName: args.displayName },
	});

	const user = (await database.select({ defaultWorkspaceId: users.defaultWorkspaceId })
		.from(users).where(eq(users.userId, args.userId)).limit(1))[0];
	if (user?.defaultWorkspaceId) {
		if (await findAccessibleWorkspace(database, user.defaultWorkspaceId, args.userId)) {
			await ensureWorkspaceDependencies(database, user.defaultWorkspaceId, args.userId);
			return { workspaceId: user.defaultWorkspaceId, createdPersonalTeam: false };
		}
		await database.update(users).set({ defaultWorkspaceId: null }).where(and(
			eq(users.userId, args.userId),
			eq(users.defaultWorkspaceId, user.defaultWorkspaceId),
		));
	}

	let workspace = (await database.select({ id: workspaces.id }).from(workspaces)
		.where(eq(workspaces.ownerUserId, args.userId)).orderBy(asc(workspaces.createdAt)).limit(1))[0];
	if (!workspace) {
		workspace = (await database.select({ id: workspaces.id }).from(workspaces).where(and(
			eq(workspaces.ownerUserId, args.userId),
			ilike(workspaces.slug, `${args.baseSlug}%`),
		)).orderBy(asc(workspaces.createdAt)).limit(1))[0];
	}
	if (workspace) {
		await ensureWorkspaceDependencies(database, workspace.id, args.userId);
		await database.update(users).set({ defaultWorkspaceId: workspace.id }).where(eq(users.userId, args.userId));
		return { workspaceId: workspace.id, createdPersonalTeam: false };
	}

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const slug = attempt === 0
			? args.baseSlug
			: `${args.baseSlug}-${crypto.randomUUID().slice(0, 4)}`;
		try {
			const [created] = await database.insert(workspaces).values({
				id: crypto.randomUUID(),
				name: "Personal",
				slug,
				ownerUserId: args.userId,
			}).returning({ id: workspaces.id });
			if (!created) continue;
			await ensureWorkspaceDependencies(database, created.id, args.userId);
			await database.update(users).set({ defaultWorkspaceId: created.id }).where(and(
				eq(users.userId, args.userId),
				isNull(users.defaultWorkspaceId),
			));
			return { workspaceId: created.id, createdPersonalTeam: true };
		} catch (error) {
			if (!/duplicate|unique/i.test(error instanceof Error ? error.message : String(error))) throw error;
		}
	}

	throw new Error("Could not obtain a workspace id");
}
