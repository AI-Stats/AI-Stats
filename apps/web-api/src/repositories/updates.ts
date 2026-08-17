import { v2Labs, v2Models } from "@phaseo/db/schema";
import { and, eq, isNotNull, or } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listModelEventRows(env: Env, organisationId?: string): Promise<Array<Record<string, unknown>>> {
	const { db, client } = createDatabase(env);
	try {
		const conditions = [
			eq(v2Models.hidden, false),
			or(isNotNull(v2Models.announcedAt), isNotNull(v2Models.releasedAt), isNotNull(v2Models.deprecatedAt), isNotNull(v2Models.retiredAt))!,
		];
		if (organisationId) conditions.push(eq(v2Models.labSlug, organisationId));
		const rows = await db.select({
			model_id: v2Models.modelSlug, name: v2Models.name, organisation_id: v2Models.labSlug,
			announcement_date: v2Models.announcedAt, release_date: v2Models.releasedAt,
			deprecation_date: v2Models.deprecatedAt, retirement_date: v2Models.retiredAt,
			organisation_lab_slug: v2Labs.labSlug, organisation_name: v2Labs.name,
		}).from(v2Models).leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(and(...conditions));
		return rows.map((row) => ({ ...row, organisation: { organisation_id: row.organisation_lab_slug, name: row.organisation_name } }));
	} finally { await client.end({ timeout: 1 }); }
}
