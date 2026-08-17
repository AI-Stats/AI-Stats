import { creditLedger, keys, managementKeys, wallets, workspaceMembers, workspaces } from "@phaseo/db/schema";
import { and, eq, gt, inArray, ne } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function findWorkspaceRole(userId: string, workspaceId: string): Promise<string | null> {
	return withDatabase(async (db) => {
		const row = await db.query.workspaceMembers.findFirst({
			columns: { role: true },
			where: (member, { and, eq }) => and(eq(member.userId, userId), eq(member.workspaceId, workspaceId)),
		});
		return row?.role ?? null;
	});
}

export async function findWorkspaceOwnerUserId(workspaceId: string): Promise<string | null> {
	return withDatabase(async (db) => {
		const row = await db.query.workspaces.findFirst({
			columns: { ownerUserId: true },
			where: eq(workspaces.id, workspaceId),
		});
		return row?.ownerUserId ?? null;
	});
}

export async function userHasPaidWorkspaceAccess(userId: string): Promise<boolean> {
	return withDatabase(async (db) => {
		const [row] = await db.select({ id: creditLedger.id })
			.from(workspaceMembers)
			.innerJoin(creditLedger, eq(creditLedger.workspaceId, workspaceMembers.workspaceId))
			.where(and(
				eq(workspaceMembers.userId, userId),
				inArray(workspaceMembers.role, ["owner", "admin"]),
				inArray(creditLedger.kind, ["top_up", "top_up_one_off", "auto_top_up"]),
				inArray(creditLedger.status, ["Succeeded", "succeeded", "paid", "Paid"]),
				gt(creditLedger.amountNanos, 0),
			)).limit(1);
		return Boolean(row);
	});
}

export async function countWorkspaceKeys(workspaceId: string, chatManagedKeyName: string): Promise<number> {
	return withDatabase(async (db) => {
		const [apiKeyCount, managementKeyCount] = await Promise.all([
			db.$count(keys, and(eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted"), ne(keys.name, chatManagedKeyName))),
			db.$count(managementKeys, eq(managementKeys.workspaceId, workspaceId)),
		]);
		return apiKeyCount + managementKeyCount;
	});
}

export async function findWorkspaceWallet(workspaceId: string) {
	return withDatabase((db) => db.query.wallets.findFirst({
		columns: { workspaceId: true, stripeCustomerId: true },
		where: (wallet, { eq }) => eq(wallet.workspaceId, workspaceId),
	}));
}

export async function upsertWorkspaceWallet(workspaceId: string, stripeCustomerId: string): Promise<void> {
	await withDatabase(async (db) => {
		await db.insert(wallets).values({ workspaceId, stripeCustomerId }).onConflictDoUpdate({
			target: wallets.workspaceId,
			set: { stripeCustomerId, updatedAt: new Date().toISOString() },
		});
	});
}
