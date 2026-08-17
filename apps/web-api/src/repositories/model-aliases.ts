import { and, asc, eq, isNull, lte, or, gt } from "@phaseo/db/query";
import { v2ModelAliases } from "@phaseo/db/schema";

import type { Env } from "@/env";
import { createDatabase } from "@/data/db";

export type ModelAlias = {
	alias_slug: string;
	alias_type: string;
};

export async function listActiveModelAliases(
	env: Env,
	modelSlug: string,
): Promise<ModelAlias[]> {
	const { db, client } = createDatabase(env);
	const now = new Date().toISOString();

	try {
		const rows = await db
			.select({
				aliasSlug: v2ModelAliases.aliasSlug,
				aliasType: v2ModelAliases.aliasType,
			})
			.from(v2ModelAliases)
			.where(and(
				eq(v2ModelAliases.modelSlug, modelSlug.trim().toLowerCase()),
				eq(v2ModelAliases.enabled, true),
				or(isNull(v2ModelAliases.effectiveFrom), lte(v2ModelAliases.effectiveFrom, now)),
				or(isNull(v2ModelAliases.effectiveTo), gt(v2ModelAliases.effectiveTo, now)),
			))
			.orderBy(asc(v2ModelAliases.aliasSlug));

		return rows.map((row) => ({
			alias_slug: row.aliasSlug,
			alias_type: row.aliasType,
		}));
	} finally {
		await client.end({ timeout: 1 });
	}
}
