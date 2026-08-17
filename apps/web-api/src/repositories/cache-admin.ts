import { webCacheGenerations, webCachePurgeEvents } from "@phaseo/db/schema";
import { desc, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function loadCacheAdminState(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const [generations, events] = await Promise.all([db.select().from(webCacheGenerations).orderBy(webCacheGenerations.scope), db.select().from(webCachePurgeEvents).orderBy(desc(webCachePurgeEvents.createdAt)).limit(25)]);
		return { generations, events };
	} finally { await client.end({ timeout: 1 }); }
}

export async function bumpCacheGeneration(env: Env, scope: string, actorUserId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.insert(webCacheGenerations).values({ scope, generation: 2, updatedBy: actorUserId }).onConflictDoUpdate({ target: webCacheGenerations.scope, set: { generation: sql`${webCacheGenerations.generation}+1`, updatedAt: new Date().toISOString(), updatedBy: actorUserId } }).returning({ generation: webCacheGenerations.generation });
		return Number(row?.generation ?? 1);
	} finally { await client.end({ timeout: 1 }); }
}

export async function recordCachePurge(env: Env, event: { scope: string; targetId: string | null; tags: string[]; browserGenerationBumped: boolean; generation: number | null; actorUserId: string; purgeSucceeded: boolean; purgeError: unknown }) {
	const { db, client } = createDatabase(env);
	try { await db.insert(webCachePurgeEvents).values({ scope: event.scope, targetId: event.targetId, tags: event.tags, browserGenerationBumped: event.browserGenerationBumped, generation: event.generation, actorUserId: event.actorUserId, purgeSucceeded: event.purgeSucceeded, purgeError: event.purgeError }); }
	finally { await client.end({ timeout: 1 }); }
}
