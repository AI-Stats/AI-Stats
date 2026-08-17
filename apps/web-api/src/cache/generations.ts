import { webCacheGenerations } from "@phaseo/db/schema";
import { eq } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export type CacheGeneration = {
	scope: string;
	generation: number;
	updatedAt: string | null;
};

export async function getCacheGeneration(
	env: Env,
	scope: string,
): Promise<CacheGeneration> {
	const { db, client } = createDatabase(env);
	try {
		const [result] = await db.select({ generation: webCacheGenerations.generation, updatedAt: webCacheGenerations.updatedAt }).from(webCacheGenerations).where(eq(webCacheGenerations.scope, scope)).limit(1);
		return { scope, generation: Math.max(1, Number(result?.generation ?? 1)), updatedAt: result?.updatedAt ?? null };
	} catch (error) {
		console.warn("web_cache_generation_unavailable", {
			scope,
			error: error instanceof Error ? error.message : String(error),
		});
		return { scope, generation: 1, updatedAt: null };
	} finally {
		await client.end({ timeout: 1 });
	}
}
