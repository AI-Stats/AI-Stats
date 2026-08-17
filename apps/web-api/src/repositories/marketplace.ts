import { presetLineage, presets, presetVersions, workspacePublisherHandleAliases, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

async function counts(db: ReturnType<typeof createDatabase>["db"], presetIds: string[]) {
	if (!presetIds.length) return new Map<string, { direct: number; descendants: number }>();
	const [direct, descendants] = await Promise.all([
		db.select({ id: presets.sourcePresetId, value: sql<number>`count(*)::int` }).from(presets)
			.where(and(inArray(presets.sourcePresetId, presetIds), isNull(presets.archivedAt))).groupBy(presets.sourcePresetId),
		db.select({ id: presetLineage.ancestorPresetId, value: sql<number>`count(*)::int` }).from(presetLineage)
			.innerJoin(presets, eq(presets.id, presetLineage.descendantPresetId))
			.where(and(inArray(presetLineage.ancestorPresetId, presetIds), sql`${presetLineage.depth} > 0`, isNull(presets.archivedAt))).groupBy(presetLineage.ancestorPresetId),
	]);
	const result = new Map(presetIds.map((id) => [id, { direct: 0, descendants: 0 }]));
	for (const row of direct) if (row.id) result.get(row.id)!.direct = Number(row.value);
	for (const row of descendants) result.get(row.id)!.descendants = Number(row.value);
	return result;
}

export async function listMarketplacePresets(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ id: presets.id, name: presets.name, slug: presets.slug, description: presets.description, created_at: presets.createdAt, source_preset_id: presets.sourcePresetId, workspace_id: presets.workspaceId, publisher_name: workspaces.name, publisher_handle: workspaces.publisherHandle })
			.from(presets).innerJoin(workspaces, eq(workspaces.id, presets.workspaceId))
			.where(and(eq(presets.visibility, "public"), isNull(presets.archivedAt))).orderBy(desc(presets.createdAt));
		const workspaceIds = [...new Set(rows.map((row) => row.workspace_id))];
		const aliases = workspaceIds.length ? await db.select({ workspaceId: workspacePublisherHandleAliases.workspaceId, handle: workspacePublisherHandleAliases.handle }).from(workspacePublisherHandleAliases).where(inArray(workspacePublisherHandleAliases.workspaceId, workspaceIds)) : [];
		const aliasesByWorkspace = new Map<string, string[]>();
		for (const alias of aliases) aliasesByWorkspace.set(alias.workspaceId, [...(aliasesByWorkspace.get(alias.workspaceId) ?? []), alias.handle]);
		const forkCounts = await counts(db, rows.map((row) => row.id));
		return rows.flatMap(({ publisher_handle, publisher_name, ...row }) => { const handle = publisher_handle.trim(); const count = forkCounts.get(row.id)!; return handle ? [{ ...row, forkCount: count.direct, descendantCount: count.descendants, canonicalModel: `@${handle}/${row.slug}`, publisher: { handle, aliases: aliasesByWorkspace.get(row.workspace_id) ?? [], displayName: publisher_name || handle } }] : []; });
	} finally { await client.end({ timeout: 1 }); }
}

export async function getMarketplacePreset(env: Env, presetId: string, requestedVersion?: number) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({ id: presets.id, name: presets.name, slug: presets.slug, description: presets.description, config: presets.config, visibility: presets.visibility, created_at: presets.createdAt, source_preset_id: presets.sourcePresetId, workspace_id: presets.workspaceId, publisher_name: workspaces.name, publisher_handle: workspaces.publisherHandle })
			.from(presets).innerJoin(workspaces, eq(workspaces.id, presets.workspaceId))
			.where(and(eq(presets.id, presetId), eq(presets.visibility, "public"), isNull(presets.archivedAt))).limit(1);
		if (!row || !row.publisher_handle.trim()) return null;
		const versions = await db.select({ id: presetVersions.id, version_number: presetVersions.versionNumber, version_label: presetVersions.versionLabel, versioning_method: presetVersions.versioningMethod, release_notes: presetVersions.releaseNotes, created_at: presetVersions.createdAt })
			.from(presetVersions).where(and(eq(presetVersions.presetId, row.id), eq(presetVersions.visibility, "public"))).orderBy(desc(presetVersions.versionNumber));
		const { publisher_handle, publisher_name, ...publicRow } = row;
		let displayed: Record<string, unknown> = publicRow;
		if (requestedVersion) {
			const [version] = await db.select({ name: presetVersions.name, slug: presetVersions.slug, description: presetVersions.description, config: presetVersions.config, visibility: presetVersions.visibility }).from(presetVersions)
				.where(and(eq(presetVersions.presetId, row.id), eq(presetVersions.versionNumber, requestedVersion), eq(presetVersions.visibility, "public"))).limit(1);
			if (!version) return { versionNotFound: true as const };
			displayed = { ...publicRow, ...version };
		}
		let sourcePreset: { id: string; name: string } | null = null;
		if (row.source_preset_id) { const [source] = await db.select({ id: presets.id, name: presets.name }).from(presets).where(and(eq(presets.id, row.source_preset_id), eq(presets.visibility, "public"), isNull(presets.archivedAt))).limit(1); sourcePreset = source ?? null; }
		const count = (await counts(db, [row.id])).get(row.id)!; const handle = publisher_handle.trim();
		return { preset: { ...displayed, forkCount: count.direct, descendantCount: count.descendants, canonicalModel: `@${handle}/${row.slug}`, publisher: { handle, displayName: publisher_name || handle } }, versions, sourcePreset };
	} finally { await client.end({ timeout: 1 }); }
}
