import { v2LabLinks, v2Labs, v2Models } from "@phaseo/db/schema";
import { and, desc, eq, isNotNull, or } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function findOrganisation(env: Env, organisationId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select().from(v2Labs).where(eq(v2Labs.labSlug, organisationId)).limit(1);
		return row ?? null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function listOrganisationModels(env: Env, organisationId: string, limit?: number) {
	const { db, client } = createDatabase(env);
	try {
		const conditions = [eq(v2Models.labSlug, organisationId), eq(v2Models.hidden, false)];
		if (limit !== undefined) conditions.push(or(isNotNull(v2Models.releasedAt), isNotNull(v2Models.announcedAt))!);
		let query = db.select().from(v2Models).where(and(...conditions)).orderBy(desc(v2Models.releasedAt));
		if (limit !== undefined) query = query.limit(Math.max(1, Math.min(100, limit))) as typeof query;
		return await query;
	} finally { await client.end({ timeout: 1 }); }
}

export async function listOrganisationLinks(env: Env, organisationId: string) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({ platform: v2LabLinks.platform, url: v2LabLinks.url })
			.from(v2LabLinks).where(eq(v2LabLinks.labSlug, organisationId));
	} finally { await client.end({ timeout: 1 }); }
}
