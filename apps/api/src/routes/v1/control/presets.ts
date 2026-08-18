import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { getSupabaseAdmin } from "@/runtime/env";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { json, withRuntime } from "@/routes/utils";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import {
	type ManagementRouteAuth,
	internalServerError,
	requireCapability,
	requireOAuthWorkspaceRole,
} from "./route-helpers";

type PresetRow = {
	id: string;
	workspace_id: string;
	name: string | null;
	slug?: string | null;
	description?: string | null;
	config?: unknown;
	visibility?: string | null;
	created_by?: string | null;
	source_preset_id?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	draft_name?: string | null;
	draft_slug?: string | null;
	draft_description?: string | null;
	draft_config?: unknown;
	draft_visibility?: string | null;
	active_version_id?: string | null;
	versioning_method?: string | null;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;

function parsePositiveInt(raw: string | null, fallback: number, max: number): number {
	if (!raw) return fallback;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return fallback;
	const normalized = Math.floor(parsed);
	if (normalized <= 0) return fallback;
	return Math.min(normalized, max);
}

function parseOffset(raw: string | null): number {
	if (!raw) return 0;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return Math.floor(parsed);
}

function parsePathId(url: URL): string | null {
	const segments = url.pathname.split("/").filter(Boolean);
	const candidate = segments.at(-1);
	if (!candidate || candidate === "presets") return null;
	return decodeURIComponent(candidate).trim() || null;
}

function normalizePresetName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "";
	return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function normalizePresetSlug(value: unknown): string {
	return String(value ?? "").trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9._:-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-._:]+|[-._:]+$/g, "");
}

function validatePresetName(name: string): string | null {
	const normalized = normalizePresetName(name);
	if (!normalized || normalized.length < 2) return "name is required";
	if (normalized.length > 100) return "name must be 100 characters or fewer";
	if (!/^@[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(normalized)) {
		return "name must start with @ and contain only letters, numbers, hyphens, underscores, and periods";
	}
	return null;
}

function normalizeVisibility(value: unknown): "private" | "team" | "public" {
	if (value === "private" || value === "team" || value === "public") return value;
	return "team";
}

function normalizeConfig(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function formatPreset(row: PresetRow) {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		name: row.draft_name ?? row.name ?? null,
		slug: row.draft_slug ?? row.slug ?? null,
		description: row.draft_description ?? row.description ?? null,
		config: row.draft_config ?? row.config ?? {},
		visibility: row.draft_visibility ?? row.visibility ?? "team",
		active_version_id: row.active_version_id ?? null,
		versioning_method: row.versioning_method ?? "sequential",
		created_by: row.created_by ?? null,
		source_preset_id: row.source_preset_id ?? null,
		created_at: row.created_at ?? null,
		updated_at: row.updated_at ?? null,
	};
}

async function publicPublisher(userId: string | null | undefined): Promise<string | null> {
	if (!userId) return null;
	const { data, error } = await getSupabaseAdmin().from("users").select("public_profile_enabled,public_profile_slug").eq("user_id", userId).maybeSingle();
	if (error) throw new Error(error.message || "Failed to fetch public profile");
	const slug = String(data?.public_profile_slug ?? "").trim().toLowerCase();
	return data?.public_profile_enabled && slug ? slug : null;
}

async function findPreset(workspaceId: string, identifier: string): Promise<PresetRow | null> {
	const supabase = getSupabaseAdmin();
	const select = "id, workspace_id, name, slug, description, config, visibility, created_by, source_preset_id, created_at, updated_at, draft_name, draft_slug, draft_description, draft_config, draft_visibility, active_version_id, versioning_method";
	const byId = await supabase
		.from("presets")
		.select(select)
		.eq("workspace_id", workspaceId)
		.eq("id", identifier)
		.is("archived_at", null)
		.maybeSingle();
	if (byId.error) throw new Error(byId.error.message || "Failed to fetch preset");
	if (byId.data) return byId.data as PresetRow;

	const bySlug = await supabase
		.from("presets")
		.select(select)
		.eq("workspace_id", workspaceId)
		.eq("slug", identifier)
		.is("archived_at", null)
		.maybeSingle();
	if (bySlug.error) throw new Error(bySlug.error.message || "Failed to fetch preset");
	if (bySlug.data) return bySlug.data as PresetRow;

	const byName = await supabase
		.from("presets")
		.select(select)
		.eq("workspace_id", workspaceId)
		.eq("name", normalizePresetName(identifier))
		.is("archived_at", null)
		.maybeSingle();
	if (byName.error) throw new Error(byName.error.message || "Failed to fetch preset");
	return (byName.data as PresetRow | null) ?? null;
}

async function handleListPresets(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.PRESETS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin", "member"]);
	if (roleError) return roleError;

	const url = new URL(req.url);
	const offset = parseOffset(url.searchParams.get("offset"));
	const limit = parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
	const visibility = url.searchParams.get("visibility")?.trim();

	try {
		let query = getSupabaseAdmin()
			.from("presets")
			.select("id, workspace_id, name, slug, description, config, visibility, created_by, source_preset_id, created_at, updated_at, draft_name, draft_slug, draft_description, draft_config, draft_visibility, active_version_id, versioning_method")
			.eq("workspace_id", auth.value.workspaceId)
			.is("archived_at", null)
			.order("created_at", { ascending: false })
			.range(offset, offset + limit - 1);
		query = auth.value.userId
			? query.or(`visibility.neq.private,created_by.eq.${auth.value.userId}`)
			: query.neq("visibility", "private");
		if (visibility) query = query.eq("visibility", visibility);

		const { data, error } = await query;
		if (error) throw new Error(error.message || "Failed to list presets");
		return json(
			{
				data: (data ?? []).map((row) => formatPreset(row as PresetRow)),
			},
			200,
			{ "Cache-Control": "no-store" },
		);
	} catch (error: any) {
		return internalServerError("presets.list", error);
	}
}

async function handleCreatePreset(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.PRESETS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: "invalid_json", message: "Invalid JSON body" }, 400, { "Cache-Control": "no-store" });
		}
		throw error;
	}

	const name = normalizePresetName(String(body.name ?? ""));
	const nameError = validatePresetName(name);
	if (nameError) return json({ error: "bad_request", message: nameError }, 400, { "Cache-Control": "no-store" });
	const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : null;
	const slug = normalizePresetSlug(body.slug ?? name);
	if (!slug) return json({ error: "bad_request", message: "slug is required" }, 400, { "Cache-Control": "no-store" });

	try {
		const visibility = normalizeVisibility(body.visibility);
		const publisher = visibility === "public" ? await publicPublisher(auth.value.userId) : null;
		if (visibility === "public" && !publisher) return json({ error: "public_profile_required", message: "Enable a public profile and choose a username before publishing a preset" }, 409, { "Cache-Control": "no-store" });
		const slugQuery = getSupabaseAdmin().from("presets").select("id").eq("workspace_id", auth.value.workspaceId).eq("slug", slug);
		const { data: slugDuplicate, error: slugError } = await slugQuery.maybeSingle();
		if (slugError) throw new Error(slugError.message || "Failed to check preset slug");
		if (slugDuplicate) return json({ error: "conflict", message: `Preset slug "${slug}" already exists in this workspace` }, 409, { "Cache-Control": "no-store" });
		if (visibility === "public") {
			const { data: publicDuplicate, error: publicError } = await getSupabaseAdmin().from("presets").select("id").eq("visibility", "public").eq("created_by", auth.value.userId).eq("slug", slug).maybeSingle();
			if (publicError) throw new Error(publicError.message || "Failed to check public preset slug");
			if (publicDuplicate) return json({ error: "public_slug_conflict", message: `Public preset slug "${slug}" is already in use` }, 409, { "Cache-Control": "no-store" });
		}
		const { data: duplicate, error: duplicateError } = await getSupabaseAdmin()
			.from("presets")
			.select("id")
			.eq("workspace_id", auth.value.workspaceId)
			.eq("name", name)
			.maybeSingle();
		if (duplicateError) throw new Error(duplicateError.message || "Failed to check preset name");
		if (duplicate) {
			return json({ error: "conflict", message: `Preset "${name}" already exists in this workspace` }, 409, { "Cache-Control": "no-store" });
		}

		const { data, error } = await getSupabaseAdmin()
			.from("presets")
			.insert({
				workspace_id: auth.value.workspaceId,
				name,
				slug,
				description,
				config: normalizeConfig(body.config),
				visibility,
				created_by: auth.value.userId ?? null,
				versioning_method: ["sequential", "semver", "date"].includes(String(body.versioning_method)) ? body.versioning_method : "sequential",
			})
			.select("id, workspace_id, name, slug, description, config, visibility, created_by, source_preset_id, created_at, updated_at, draft_name, draft_slug, draft_description, draft_config, draft_visibility, active_version_id, versioning_method")
			.maybeSingle();
		if (error) throw new Error(error.message || "Failed to create preset");
		return json({ data: formatPreset(data as PresetRow), canonical_model: visibility === "public" ? `@${publisher}/${slug}` : `@${slug}` }, 201, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("presets.create", error);
	}
}

async function handleGetPreset(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.PRESETS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin", "member"]);
	if (roleError) return roleError;

	const identifier = parsePathId(new URL(req.url));
	if (!identifier) return json({ error: "bad_request", message: "Preset id, slug, or name is required" }, 400, { "Cache-Control": "no-store" });
	try {
		const preset = await findPreset(auth.value.workspaceId, identifier);
		if (!preset) return json({ error: "not_found", message: "Preset not found" }, 404, { "Cache-Control": "no-store" });
		return json({ data: formatPreset(preset) }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("presets.get", error);
	}
}

async function handleUpdatePreset(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.PRESETS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parsePathId(new URL(req.url));
	if (!identifier) return json({ error: "bad_request", message: "Preset id, slug, or name is required" }, 400, { "Cache-Control": "no-store" });

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: "invalid_json", message: "Invalid JSON body" }, 400, { "Cache-Control": "no-store" });
		}
		throw error;
	}

	try {
		const existing = await findPreset(auth.value.workspaceId, identifier);
		if (!existing) return json({ error: "not_found", message: "Preset not found" }, 404, { "Cache-Control": "no-store" });

		const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
		if (typeof body.name === "string") {
			const name = normalizePresetName(body.name);
			const nameError = validatePresetName(name);
			if (nameError) return json({ error: "bad_request", message: nameError }, 400, { "Cache-Control": "no-store" });
			const { data: duplicate, error: duplicateError } = await getSupabaseAdmin()
				.from("presets")
				.select("id")
				.eq("workspace_id", auth.value.workspaceId)
				.eq("name", name)
				.neq("id", existing.id)
				.maybeSingle();
			if (duplicateError) throw new Error(duplicateError.message || "Failed to check preset name");
			if (duplicate) {
				return json({ error: "conflict", message: `Preset "${name}" already exists in this workspace` }, 409, { "Cache-Control": "no-store" });
			}
			updatePayload.draft_name = name;
		}
		if (typeof body.slug === "string") {
			const slug = normalizePresetSlug(body.slug);
			if (!slug) return json({ error: "bad_request", message: "slug is required" }, 400, { "Cache-Control": "no-store" });
			updatePayload.draft_slug = slug;
		}
		if (body.description !== undefined) updatePayload.draft_description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
		if (body.config !== undefined) updatePayload.draft_config = { ...normalizeConfig(existing.draft_config ?? existing.config), ...normalizeConfig(body.config) };
		if (body.visibility !== undefined) updatePayload.draft_visibility = normalizeVisibility(body.visibility);
		if (["sequential", "semver", "date"].includes(String(body.versioning_method))) updatePayload.versioning_method = body.versioning_method;
		const nextSlug = String(updatePayload.draft_slug ?? existing.draft_slug ?? existing.slug ?? "");
		const nextVisibility = String(updatePayload.draft_visibility ?? existing.draft_visibility ?? existing.visibility ?? "team");
		const publisher = nextVisibility === "public" ? await publicPublisher(existing.created_by) : null;
		if (nextVisibility === "public" && !publisher) return json({ error: "public_profile_required", message: "Enable a public profile and choose a username before publishing a preset" }, 409, { "Cache-Control": "no-store" });
		const { data: slugDuplicate, error: slugError } = await getSupabaseAdmin().from("presets").select("id").eq("workspace_id", auth.value.workspaceId).eq("slug", nextSlug).neq("id", existing.id).maybeSingle();
		if (slugError) throw new Error(slugError.message || "Failed to check preset slug");
		if (slugDuplicate) return json({ error: "conflict", message: `Preset slug "${nextSlug}" already exists in this workspace` }, 409, { "Cache-Control": "no-store" });
		if (nextVisibility === "public") {
			const { data: publicDuplicate, error: publicError } = await getSupabaseAdmin().from("presets").select("id").eq("visibility", "public").eq("created_by", existing.created_by).eq("slug", nextSlug).neq("id", existing.id).maybeSingle();
			if (publicError) throw new Error(publicError.message || "Failed to check public preset slug");
			if (publicDuplicate) return json({ error: "public_slug_conflict", message: `Public preset slug "${nextSlug}" is already in use` }, 409, { "Cache-Control": "no-store" });
		}

		const { error } = await getSupabaseAdmin()
			.from("presets")
			.update(updatePayload)
			.eq("workspace_id", auth.value.workspaceId)
			.eq("id", existing.id);
		if (error) throw new Error(error.message || "Failed to update preset");
		const updated = await findPreset(auth.value.workspaceId, existing.id);
		return json({ data: formatPreset(updated as PresetRow) }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("presets.update", error);
	}
}

async function handleDeletePreset(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.PRESETS_DELETE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parsePathId(new URL(req.url));
	if (!identifier) return json({ error: "bad_request", message: "Preset id, slug, or name is required" }, 400, { "Cache-Control": "no-store" });

	try {
		const existing = await findPreset(auth.value.workspaceId, identifier);
		if (!existing) return json({ error: "not_found", message: "Preset not found" }, 404, { "Cache-Control": "no-store" });
		const { error } = await getSupabaseAdmin()
			.from("presets")
			.update({ archived_at: new Date().toISOString() })
			.eq("workspace_id", auth.value.workspaceId)
			.eq("id", existing.id);
		if (error) throw new Error(error.message || "Failed to delete preset");
		return json({ deleted: true }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("presets.delete", error);
	}
}

async function handlePublishPresetVersion(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.PRESETS_WRITE); if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]); if (roleError) return roleError;
	if (!auth.value.userId) return json({ error: "user_identity_required" }, 403, { "Cache-Control": "no-store" });
	const segments = new URL(req.url).pathname.split("/").filter(Boolean); const presetId = segments.at(-2);
	if (!presetId) return json({ error: "bad_request" }, 400, { "Cache-Control": "no-store" });
	const body = await req.json().catch(() => ({})) as { release_notes?: string; version_label?: string };
	try {
		const preset = await findPreset(auth.value.workspaceId, presetId); if (!preset) return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
		const result = await getSupabaseAdmin().rpc("publish_preset_version", { target_preset_id: preset.id, actor_user_id: auth.value.userId, notes: String(body.release_notes ?? "").slice(0, 1000), requested_label: body.version_label ? String(body.version_label).slice(0, 100) : null });
		if (result.error) {
			const message = result.error.message ?? "";
			if (message.includes("invalid_semver_label")) return json({ error: "invalid_semver_label" }, 400, { "Cache-Control": "no-store" });
			if (message.includes("preset_not_found")) return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
			if (message.includes("preset_publish_forbidden")) return json({ error: "forbidden" }, 403, { "Cache-Control": "no-store" });
			throw new Error(message || "Failed to publish preset version");
		}
		return json({ data: Array.isArray(result.data) ? result.data[0] : result.data }, 201, { "Cache-Control": "no-store" });
	} catch (error: any) { return internalServerError("presets.publish-version", error); }
}

export const presetsRoutes = new Hono<Env>();

presetsRoutes.get("/", withRuntime(handleListPresets));
presetsRoutes.post("/", withRuntime(handleCreatePreset));
presetsRoutes.post("/:id/versions", withRuntime(handlePublishPresetVersion));
presetsRoutes.get("/:id", withRuntime(handleGetPreset));
presetsRoutes.patch("/:id", withRuntime(handleUpdatePreset));
presetsRoutes.delete("/:id", withRuntime(handleDeletePreset));
