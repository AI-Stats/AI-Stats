import { presetVersions, presets, workspaceMembers, workspacePublisherHandleAliases, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

const presetRow = (row: typeof presets.$inferSelect) => ({ id: row.id, workspace_id: row.workspaceId, name: row.name, description: row.description, config: row.config, created_by: row.createdBy, created_at: row.createdAt, updated_at: row.updatedAt, visibility: row.visibility, source_preset_id: row.sourcePresetId, slug: row.slug, draft_name: row.draftName, draft_slug: row.draftSlug, draft_description: row.draftDescription, draft_config: row.draftConfig, draft_visibility: row.draftVisibility, active_version_id: row.activeVersionId, source_preset_version_id: row.sourcePresetVersionId, upstream_version_id: row.upstreamVersionId, root_preset_id: row.rootPresetId, fork_depth: row.forkDepth, versioning_method: row.versioningMethod, archived_at: row.archivedAt });

function hasDraftChanges(row: typeof presets.$inferSelect) { return row.draftName !== row.name || row.draftSlug !== row.slug || row.draftDescription !== row.description || JSON.stringify(row.draftConfig) !== JSON.stringify(row.config) || row.draftVisibility !== row.visibility; }

export async function listPresetWorkspaces(env: Env, userId: string) {
	const { db, client } = createDatabase(env); try { return await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaceMembers).innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId)).where(eq(workspaceMembers.userId, userId)); } finally { await client.end({ timeout: 1 }); }
}

export async function getPresetWorkspacePublisher(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env); try { const [row] = await db.select({ handle: workspaces.publisherHandle }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1); return row?.handle?.trim().toLowerCase() || null; } finally { await client.end({ timeout: 1 }); }
}

export async function listWorkspacePresets(env: Env, input: { workspaceId: string; userId: string }) {
	const { db, client } = createDatabase(env); try {
		const rows = await db.select().from(presets).where(and(eq(presets.workspaceId, input.workspaceId), isNull(presets.archivedAt), or(ne(presets.visibility, "private"), eq(presets.createdBy, input.userId)))).orderBy(desc(presets.createdAt));
		const sourceIds = [...new Set(rows.map((row) => row.sourcePresetId).filter((id): id is string => Boolean(id)))];
		const latest = new Map<string, { id: string; version_number: number }>();
		if (sourceIds.length) {
			const publicSources = await db.select({ id: presets.id }).from(presets).where(and(inArray(presets.id, sourceIds), eq(presets.visibility, "public"), isNull(presets.archivedAt)));
			const ids = publicSources.map((row) => row.id);
			if (ids.length) { const versions = await db.select({ id: presetVersions.id, presetId: presetVersions.presetId, versionNumber: presetVersions.versionNumber }).from(presetVersions).where(and(inArray(presetVersions.presetId, ids), eq(presetVersions.visibility, "public"))).orderBy(desc(presetVersions.versionNumber)); for (const version of versions) if (!latest.has(version.presetId)) latest.set(version.presetId, { id: version.id, version_number: version.versionNumber }); }
		}
		return rows.map((row) => { const lifecycle = latest.get(row.sourcePresetId ?? "") ?? null; return { ...presetRow(row), published_visibility: row.visibility, name: row.draftName ?? row.name, slug: row.draftSlug ?? row.slug, description: row.draftDescription === undefined ? row.description : row.draftDescription, config: row.draftConfig ?? row.config, visibility: row.draftVisibility ?? row.visibility, hasDraftChanges: hasDraftChanges(row), latestUpstreamVersion: lifecycle, hasUpstreamUpdate: Boolean(row.sourcePresetId && lifecycle?.id !== row.upstreamVersionId) }; });
	} finally { await client.end({ timeout: 1 }); }
}

export async function createPreset(env: Env, input: { workspaceId: string; userId: string; name: string; slug: string; description: string | null; config: Record<string, unknown>; visibility: string }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => {
		const [duplicate] = await tx.select({ id: presets.id }).from(presets).where(and(eq(presets.workspaceId, input.workspaceId), eq(presets.name, input.name), isNull(presets.archivedAt))).limit(1); if (duplicate) throw new Error("duplicate_preset");
		const [slug] = await tx.select({ id: presets.id }).from(presets).where(and(eq(presets.workspaceId, input.workspaceId), eq(presets.slug, input.slug), isNull(presets.archivedAt))).limit(1); if (slug) throw new Error("duplicate_preset_slug");
		if (input.visibility === "public") { const [workspace] = await tx.select({ handle: workspaces.publisherHandle }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1); if (!workspace?.handle) throw new Error("workspace_publisher_required"); }
		const [created] = await tx.insert(presets).values({ workspaceId: input.workspaceId, name: input.name, slug: input.slug, createdBy: input.userId, config: input.config, visibility: input.visibility, description: input.description }).returning({ id: presets.id, createdAt: presets.createdAt }); if (!created) throw new Error("preset_create_failed"); return created;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function getPreset(env: Env, presetId: string) { const { db, client } = createDatabase(env); try { const [row] = await db.select().from(presets).where(eq(presets.id, presetId)).limit(1); return row ? presetRow(row) : null; } finally { await client.end({ timeout: 1 }); } }

export async function getPresetAccess(env: Env, presetId: string) { const { db, client } = createDatabase(env); try { const [row] = await db.select().from(presets).where(and(eq(presets.id, presetId), isNull(presets.archivedAt))).limit(1); return row ? presetRow(row) : null; } finally { await client.end({ timeout: 1 }); } }

export async function listPresetVersions(env: Env, presetId: string) { const { db, client } = createDatabase(env); try { const rows = await db.select().from(presetVersions).where(eq(presetVersions.presetId, presetId)).orderBy(desc(presetVersions.versionNumber)); return rows.map((row) => ({ id: row.id, version_number: row.versionNumber, name: row.name, slug: row.slug, description: row.description, visibility: row.visibility, release_notes: row.releaseNotes, created_at: row.createdAt })); } finally { await client.end({ timeout: 1 }); } }

export async function updatePresetDraft(env: Env, input: { presetId: string; workspaceId: string; slug: string; values: Partial<typeof presets.$inferInsert>; requirePublisher: boolean }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => { await tx.execute(sql`select id from ${presets} where id=${input.presetId}::uuid for update`); const [conflict] = await tx.select({ id: presets.id }).from(presets).where(and(eq(presets.workspaceId, input.workspaceId), eq(presets.slug, input.slug), ne(presets.id, input.presetId), isNull(presets.archivedAt))).limit(1); if (conflict) throw new Error("duplicate_preset_slug"); if (input.requirePublisher) { const [workspace] = await tx.select({ handle: workspaces.publisherHandle }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1); if (!workspace?.handle) throw new Error("workspace_publisher_required"); } await tx.update(presets).set({ ...input.values, updatedAt: new Date().toISOString() }).where(eq(presets.id, input.presetId)); return true; }); } finally { await client.end({ timeout: 1 }); }
}

export async function archivePreset(env: Env, presetId: string) { const { db, client } = createDatabase(env); try { await db.update(presets).set({ archivedAt: new Date().toISOString() }).where(eq(presets.id, presetId)); } finally { await client.end({ timeout: 1 }); } }

export async function forkPreset(env: Env, input: { presetId: string; sourceVersionId?: string; workspaceId: string; userId: string; normalizeSlug: (value: unknown) => string }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => {
		const [source] = await tx.select().from(presets).where(and(eq(presets.id, input.presetId), eq(presets.visibility, "public"), isNull(presets.archivedAt))).limit(1); if (!source) throw new Error("not_public");
		let snapshot = { id: source.activeVersionId, name: source.name, slug: source.slug, description: source.description, config: source.config };
		if (input.sourceVersionId) { const [version] = await tx.select().from(presetVersions).where(and(eq(presetVersions.id, input.sourceVersionId), eq(presetVersions.presetId, source.id), eq(presetVersions.visibility, "public"))).limit(1); if (!version) throw new Error("invalid_source_version"); snapshot = { id: version.id, name: version.name, slug: version.slug, description: version.description, config: version.config }; }
		const existingRows = await tx.select({ name: presets.name, slug: presets.slug }).from(presets).where(and(eq(presets.workspaceId, input.workspaceId), isNull(presets.archivedAt))); const names = new Set(existingRows.map((row) => row.name)); const slugs = new Set(existingRows.map((row) => row.slug));
		const base = snapshot.name || "@preset"; let name = base; if (names.has(name)) { name = `${base}-copy`; for (let i=2; names.has(name) && i<=20; i++) name=`${base}-copy-${i}`; } if (names.has(name)) throw new Error("name_unavailable");
		const baseSlug = input.normalizeSlug(snapshot.slug ?? name); let slug = baseSlug; for (let i=1; slugs.has(slug) && i<=20; i++) slug=`${baseSlug}-copy${i>1?`-${i}`:""}`; if (slugs.has(slug)) throw new Error("slug_unavailable");
		const [created] = await tx.insert(presets).values({ workspaceId: input.workspaceId, name, slug, createdBy: input.userId, config: snapshot.config ?? {}, visibility: "private", sourcePresetId: source.id, sourcePresetVersionId: snapshot.id, upstreamVersionId: snapshot.id, description: snapshot.description }).returning({ id: presets.id }); if (!created) throw new Error("preset_create_failed"); return { id: created.id, name, slug, sourceId: source.id };
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function renamePublisherHandle(env: Env, input: { workspaceId: string; userId: string; handle: string }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => {
		await tx.execute(sql`select id from ${workspaces} where id=${input.workspaceId}::uuid for update`);
		const [[workspace], [membership]] = await Promise.all([tx.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1), tx.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId))).limit(1)]);
		if (!workspace) throw new Error("workspace_not_found");
		if (String(workspace.ownerUserId) !== input.userId && !["owner", "admin"].includes(String(membership?.role ?? ""))) throw new Error("publisher_handle_forbidden");
		if (workspace.publisherHandle === input.handle) return input.handle;
		const [conflict] = await tx.execute<Record<string, unknown>>(sql`select 1 from ${workspaces} where lower(publisher_handle)=${input.handle} and id<>${input.workspaceId}::uuid union all select 1 from ${workspacePublisherHandleAliases} where handle=${input.handle} and workspace_id<>${input.workspaceId}::uuid limit 1`);
		if (conflict) throw new Error("publisher_handle_reserved");
		await tx.insert(workspacePublisherHandleAliases).values({ handle: workspace.publisherHandle, workspaceId: input.workspaceId }).onConflictDoNothing();
		await tx.delete(workspacePublisherHandleAliases).where(and(eq(workspacePublisherHandleAliases.workspaceId, input.workspaceId), eq(workspacePublisherHandleAliases.handle, input.handle)));
		await tx.update(workspaces).set({ publisherHandle: input.handle, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, input.workspaceId));
		return input.handle;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function publishPresetVersion(env: Env, input: { presetId: string; userId: string; notes: string; requestedLabel: string | null }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => {
		await tx.execute(sql`select id from ${presets} where id=${input.presetId}::uuid and archived_at is null for update`);
		const [preset] = await tx.select().from(presets).where(and(eq(presets.id, input.presetId), sql`${presets.archivedAt} is null`)).limit(1); if (!preset) throw new Error("preset_not_found");
		if (String(preset.createdBy) !== input.userId) { const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, preset.workspaceId), eq(workspaceMembers.userId, input.userId))).limit(1); if ((preset.draftVisibility ?? preset.visibility) === "private" || !["owner", "admin"].includes(String(member?.role ?? ""))) throw new Error("preset_publish_forbidden"); }
		const [latest] = await tx.select({ version: presetVersions.versionNumber }).from(presetVersions).where(eq(presetVersions.presetId, preset.id)).orderBy(desc(presetVersions.versionNumber)).limit(1); const next = (latest?.version ?? 0) + 1;
		let label: string; if (preset.versioningMethod === "semver") { label = String(input.requestedLabel ?? "").trim().replace(/^v/, ""); if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/.test(label)) throw new Error("invalid_semver_label"); } else if (preset.versioningMethod === "date") { const base = new Date().toISOString().slice(0, 10).replaceAll("-", "."); const rows = await tx.select({ id: presetVersions.id }).from(presetVersions).where(and(eq(presetVersions.presetId, preset.id), sql`${presetVersions.versionLabel} like ${`${base}%`}`)); label = rows.length ? `${base}.${rows.length + 1}` : base; } else label = `v${next}`;
		const [version] = await tx.insert(presetVersions).values({ presetId: preset.id, versionNumber: next, versionLabel: label, versioningMethod: preset.versioningMethod, name: preset.draftName ?? preset.name, slug: preset.draftSlug ?? preset.slug, description: preset.draftDescription, config: preset.draftConfig ?? preset.config, visibility: preset.draftVisibility ?? preset.visibility, releaseNotes: input.notes.trim() || null, createdBy: input.userId }).returning(); if (!version) throw new Error("version_publish_failed");
		await tx.update(presets).set({ name: version.name, slug: version.slug, description: version.description, config: version.config, visibility: version.visibility, activeVersionId: version.id, updatedAt: new Date().toISOString() }).where(eq(presets.id, preset.id)); return version;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function applyPresetUpstreamVersion(env: Env, input: { presetId: string; versionId: string; userId: string }) {
	const { db, client } = createDatabase(env); try { return await db.transaction(async (tx) => {
		await tx.execute(sql`select id from ${presets} where id=${input.presetId}::uuid and archived_at is null for update`);
		const [preset] = await tx.select().from(presets).where(and(eq(presets.id, input.presetId), sql`${presets.archivedAt} is null`)).limit(1); if (!preset || String(preset.createdBy) !== input.userId) throw new Error("preset_update_forbidden"); if (!preset.sourcePresetId) throw new Error("preset_has_no_upstream");
		const changed = preset.draftName !== preset.name || preset.draftSlug !== preset.slug || preset.draftDescription !== preset.description || JSON.stringify(preset.draftConfig) !== JSON.stringify(preset.config) || preset.draftVisibility !== preset.visibility; if (changed) throw new Error("preset_has_local_draft_changes");
		const [source] = await tx.select({ id: presets.id }).from(presets).where(and(eq(presets.id, preset.sourcePresetId), eq(presets.visibility, "public"), sql`${presets.archivedAt} is null`)).limit(1); if (!source) throw new Error("upstream_preset_not_public");
		const [version] = await tx.select().from(presetVersions).where(and(eq(presetVersions.id, input.versionId), eq(presetVersions.presetId, source.id), eq(presetVersions.visibility, "public"))).limit(1); if (!version) throw new Error("upstream_version_not_public");
		await tx.update(presets).set({ draftName: version.name, draftSlug: version.slug, draftDescription: version.description, draftConfig: version.config, upstreamVersionId: version.id, updatedAt: new Date().toISOString() }).where(eq(presets.id, preset.id)); return true;
	}); } finally { await client.end({ timeout: 1 }); }
}
