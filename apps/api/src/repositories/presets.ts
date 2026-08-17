import { presetVersions, presets, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, isNull, ne, or, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const selection = {
	id: presets.id, workspace_id: presets.workspaceId, name: presets.name, slug: presets.slug,
	description: presets.description, config: presets.config, visibility: presets.visibility,
	created_by: presets.createdBy, source_preset_id: presets.sourcePresetId, created_at: presets.createdAt,
	updated_at: presets.updatedAt, draft_name: presets.draftName, draft_slug: presets.draftSlug,
	draft_description: presets.draftDescription, draft_config: presets.draftConfig,
	draft_visibility: presets.draftVisibility, active_version_id: presets.activeVersionId,
	versioning_method: presets.versioningMethod,
};

export type PresetPatch = Partial<Pick<typeof presets.$inferInsert,
	"draftName" | "draftSlug" | "draftDescription" | "draftConfig" | "draftVisibility" | "versioningMethod"
>>;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function findWorkspacePublisherHandle(workspaceId: string): Promise<string | null> {
	return withDatabase(async (db) => {
		const [row] = await db.select({ handle: workspaces.publisherHandle }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
		return row?.handle ?? null;
	});
}

export async function findPreset(workspaceId: string, identifier: string) {
	return withDatabase(async (db) => {
		const identifiers = [eq(presets.slug, identifier), eq(presets.name, identifier.startsWith("@") ? identifier : `@${identifier}`)];
		if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) identifiers.unshift(eq(presets.id, identifier));
		const [row] = await db.select(selection).from(presets).where(and(eq(presets.workspaceId, workspaceId), isNull(presets.archivedAt), or(...identifiers))).limit(1);
		return row ?? null;
	});
}

export async function listPresets(args: { workspaceId: string; userId?: string | null; visibility?: string | null; limit: number; offset: number }) {
	return withDatabase((db) => {
		const conditions = [eq(presets.workspaceId, args.workspaceId), isNull(presets.archivedAt)];
		conditions.push(args.userId ? or(ne(presets.visibility, "private"), eq(presets.createdBy, args.userId))! : ne(presets.visibility, "private"));
		if (args.visibility) conditions.push(eq(presets.visibility, args.visibility));
		return db.select(selection).from(presets).where(and(...conditions)).orderBy(desc(presets.createdAt)).limit(args.limit).offset(args.offset);
	});
}

export async function presetConflict(args: { workspaceId: string; field: "name" | "slug"; value: string; excludeId?: string }): Promise<boolean> {
	return withDatabase(async (db) => {
		const column = args.field === "name" ? presets.name : presets.slug;
		const conditions = [eq(presets.workspaceId, args.workspaceId), eq(column, args.value), isNull(presets.archivedAt)];
		if (args.excludeId) conditions.push(ne(presets.id, args.excludeId));
		const [row] = await db.select({ id: presets.id }).from(presets).where(and(...conditions)).limit(1);
		return Boolean(row);
	});
}

export async function createPreset(values: typeof presets.$inferInsert) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(presets).values(values).returning(selection);
		if (!row) throw new Error("Failed to create preset");
		return row;
	});
}

export async function updatePreset(workspaceId: string, id: string, patch: PresetPatch) {
	return withDatabase(async (db) => {
		const [row] = await db.update(presets).set({ ...patch, updatedAt: new Date().toISOString() })
			.where(and(eq(presets.workspaceId, workspaceId), eq(presets.id, id))).returning(selection);
		return row ?? null;
	});
}

export async function archivePreset(workspaceId: string, id: string): Promise<boolean> {
	return withDatabase(async (db) => (await db.update(presets).set({ archivedAt: new Date().toISOString() })
		.where(and(eq(presets.workspaceId, workspaceId), eq(presets.id, id))).returning({ id: presets.id })).length > 0);
}

const semver = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export async function publishPresetVersion(args: { workspaceId: string; presetId: string; actorUserId: string; notes: string | null; requestedLabel: string | null }) {
	return withDatabase(async (db) => db.transaction(async (tx) => {
		const [preset] = await tx.select().from(presets).where(and(eq(presets.id, args.presetId), eq(presets.workspaceId, args.workspaceId), isNull(presets.archivedAt))).limit(1).for("update");
		if (!preset) throw new Error("preset_not_found");
		const visibility = preset.draftVisibility ?? preset.visibility;
		if (preset.createdBy !== args.actorUserId && visibility === "private") throw new Error("preset_publish_forbidden");
		const [aggregate] = await tx.select({ max: sql<number>`coalesce(max(${presetVersions.versionNumber}), 0)` }).from(presetVersions).where(eq(presetVersions.presetId, preset.id));
		const versionNumber = Number(aggregate?.max ?? 0) + 1;
		let versionLabel = `v${versionNumber}`;
		if (preset.versioningMethod === "semver") {
			versionLabel = String(args.requestedLabel ?? "").trim().replace(/^v/, "");
			if (!semver.test(versionLabel)) throw new Error("invalid_semver_label");
		} else if (preset.versioningMethod === "date") {
			const now = new Date();
			const base = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}.${String(now.getUTCDate()).padStart(2, "0")}`;
			const [count] = await tx.select({ value: sql<number>`count(*)` }).from(presetVersions).where(and(eq(presetVersions.presetId, preset.id), sql`${presetVersions.versionLabel} like ${`${base}%`}`));
			versionLabel = Number(count?.value ?? 0) === 0 ? base : `${base}.${Number(count?.value ?? 0) + 1}`;
		}
		const [version] = await tx.insert(presetVersions).values({
			presetId: preset.id, versionNumber, versionLabel, versioningMethod: preset.versioningMethod,
			name: preset.draftName ?? preset.name, slug: preset.draftSlug ?? preset.slug,
			description: preset.draftDescription ?? preset.description, config: preset.draftConfig ?? preset.config,
			visibility, releaseNotes: args.notes?.trim() || null, createdBy: args.actorUserId,
		}).returning();
		if (!version) throw new Error("preset_version_insert_failed");
		await tx.update(presets).set({ name: version.name, slug: version.slug, description: version.description, config: version.config, visibility: version.visibility, activeVersionId: version.id, updatedAt: new Date().toISOString() }).where(eq(presets.id, preset.id));
		return version;
	}));
}
