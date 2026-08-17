import { keys, workspaceSettings } from "@phaseo/db/schema";
import { and, eq, ne } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export type WorkspaceSettingsPatch = Partial<Pick<typeof workspaceSettings.$inferInsert,
	| "routingMode"
	| "betaChannelEnabled"
	| "alphaChannelEnabled"
	| "responseHealingEnabled"
	| "responseHealingLocked"
	| "responseHealingMode"
	| "byokFallbackEnabled"
	| "privacyEnablePaidMayTrain"
	| "privacyEnableFreeMayTrain"
	| "privacyEnableFreeMayPublishPrompts"
	| "privacyEnableInputOutputLogging"
	| "privacyZdrOnly"
	| "ioLoggingEnabled"
	| "ioLoggingIncludeProviderPayloads"
	| "providerRestrictionMode"
	| "providerRestrictionProviderIds"
	| "providerRestrictionEnforceAllowed"
>>;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try {
		return await operation(db);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function findWorkspaceSettings(workspaceId: string) {
	return withDatabase((db) => db.query.workspaceSettings.findFirst({
		where: (settings, { eq }) => eq(settings.workspaceId, workspaceId),
	}));
}

export async function updateWorkspaceSettings(workspaceId: string, patch: WorkspaceSettingsPatch) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(workspaceSettings).values({ workspaceId, ...patch })
			.onConflictDoUpdate({
				target: workspaceSettings.workspaceId,
				set: { ...patch, updatedAt: new Date().toISOString() },
			})
			.returning();
		return row;
	});
}

export async function listActiveWorkspaceKeyIds(workspaceId: string): Promise<string[]> {
	return withDatabase(async (db) => {
		const rows = await db.select({ id: keys.id }).from(keys).where(and(
			eq(keys.workspaceId, workspaceId),
			ne(keys.status, "deleted"),
		));
		return rows.map(({ id }) => id);
	});
}
