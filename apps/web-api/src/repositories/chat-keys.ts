import { keys } from "@phaseo/db/schema";
import { and, eq } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function findChatKeyByKid(env: Env, kid: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db
			.select({ id: keys.id, workspaceId: keys.workspaceId, status: keys.status, hash: keys.hash })
			.from(keys)
			.where(eq(keys.kid, kid))
			.limit(1);
		return row ?? null;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function createChatKey(
	env: Env,
	input: { workspaceId: string; userId: string; kid: string; hash: string },
) {
	const { db, client } = createDatabase(env);
	try {
		await db
			.insert(keys)
			.values({
				workspaceId: input.workspaceId,
				name: "__chat_route_managed_key__",
				kid: input.kid,
				hash: input.hash,
				prefix: input.kid.slice(0, 6),
				status: "active",
				scopes: "[]",
				createdBy: input.userId,
				dailyLimitRequests: 0,
				weeklyLimitRequests: 0,
				monthlyLimitRequests: 0,
				dailyLimitCostNanos: 0,
				weeklyLimitCostNanos: 0,
				monthlyLimitCostNanos: 0,
			})
			.onConflictDoNothing({ target: keys.kid });
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function updateChatKeyHash(env: Env, id: string, workspaceId: string, hash: string) {
	const { db, client } = createDatabase(env);
	try {
		await db
			.update(keys)
			.set({ hash })
			.where(and(eq(keys.id, id), eq(keys.workspaceId, workspaceId)));
	} finally {
		await client.end({ timeout: 1 });
	}
}
