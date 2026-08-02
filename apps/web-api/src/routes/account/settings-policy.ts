import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { requireAccountWorkspace, type AccountWorkspaceContext } from "./context";
import { purgeWorkerCacheTags } from "@/http/invalidation";

const GUARDRAIL_COLUMNS = "id,workspace_id,enabled,name,description,privacy_enable_paid_may_train,privacy_enable_free_may_train,privacy_enable_free_may_publish_prompts,privacy_enable_input_output_logging,privacy_zdr_only,provider_restriction_mode,provider_restriction_provider_ids,provider_restriction_enforce_allowed,model_restriction_mode,allowed_api_model_ids,prompt_injection_enabled,prompt_injection_action,sensitive_info_enabled,sensitive_info_default_action,sensitive_info_rules,daily_limit_requests,weekly_limit_requests,monthly_limit_requests,daily_limit_cost_nanos,weekly_limit_cost_nanos,monthly_limit_cost_nanos,created_at,updated_at";

async function loadGuardrailReference(context: AccountWorkspaceContext) {
	const [teamResult, keysResult, providersResult, modelsResult] = await Promise.all([
		context.client.from("workspaces").select("id,name").eq("id", context.workspaceId).maybeSingle(),
		context.client.from("keys").select("id,name,prefix,status,created_at")
			.eq("workspace_id", context.workspaceId).neq("status", "deleted")
			.neq("name", "__chat_route_managed_key__").order("created_at", { ascending: false }),
		context.client.from("v2_providers").select("api_provider_id:provider_slug,api_provider_name:name").order("name", { ascending: true }),
		context.client.from("v2_model_provider_routes").select("provider_id:provider_slug,api_model_id:model_slug,internal_model_id:model_slug,is_active_gateway:routing_enabled").eq("routing_enabled", true).in("status", ["active", "degraded"]),
	]);
	if ([teamResult, keysResult, providersResult, modelsResult].some((result) => result.error)) throw new Error("settings_unavailable");
	return {
		activeProviderModels: (modelsResult.data ?? []).map((row) => ({ apiModelId: row.api_model_id, internalModelId: row.internal_model_id ?? null, providerId: row.provider_id })),
		keys: (keysResult.data ?? []).map((key) => ({ id: key.id, name: key.name, prefix: key.prefix, status: key.status })),
		providers: (providersResult.data ?? []).map((provider) => ({ id: provider.api_provider_id, name: provider.api_provider_name ?? provider.api_provider_id })),
		teamName: teamResult.data?.name ?? null,
	};
}

export const accountSettingsPolicyRouter = new Hono<{ Bindings: Env }>();

accountSettingsPolicyRouter.get("/routing", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ responseHealingEnabled: false, responseHealingLocked: false, responseHealingMode: "safe", routingMode: "balanced", teamName: null, alphaChannelEnabled: false, betaChannelEnabled: false, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const [teamResult, settingsResult] = await Promise.all([
		context.client.from("workspaces").select("id,name").eq("id", workspaceId).maybeSingle(),
		context.client.from("workspace_settings").select("routing_mode,beta_channel_enabled,alpha_channel_enabled,response_healing_enabled,response_healing_locked,response_healing_mode").eq("workspace_id", workspaceId).maybeSingle(),
	]);
	if (teamResult.error || settingsResult.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	return c.json({
		responseHealingEnabled: Boolean(settingsResult.data?.response_healing_enabled),
		responseHealingLocked: Boolean(settingsResult.data?.response_healing_locked),
		responseHealingMode: settingsResult.data?.response_healing_mode === "strict" ? "strict" : "safe",
		routingMode: settingsResult.data?.routing_mode ?? "balanced",
		teamName: teamResult.data?.name ?? null,
		alphaChannelEnabled: Boolean(settingsResult.data?.alpha_channel_enabled),
		betaChannelEnabled: Boolean(settingsResult.data?.beta_channel_enabled),
		workspaceId,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.put("/routing", async (c) => {
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim();
	if (!workspaceId) return c.json({ error: "workspace_required" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!['owner', 'admin'].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const mode = ["balanced", "price", "latency", "throughput"].includes(String(body.mode)) ? String(body.mode) : "balanced";
	const payload: Record<string, unknown> = { workspace_id: workspaceId, routing_mode: mode, updated_at: new Date().toISOString() };
	if (typeof body.betaChannelEnabled === "boolean") payload.beta_channel_enabled = body.betaChannelEnabled;
	if (typeof body.alphaChannelEnabled === "boolean") payload.alpha_channel_enabled = body.betaChannelEnabled === false ? false : body.alphaChannelEnabled;
	if (typeof body.responseHealingEnabled === "boolean") payload.response_healing_enabled = body.responseHealingEnabled;
	if (typeof body.responseHealingLocked === "boolean") payload.response_healing_locked = body.responseHealingLocked;
	if (body.responseHealingMode === "safe" || body.responseHealingMode === "strict") payload.response_healing_mode = body.responseHealingMode;
	const result = await context.client.from("workspace_settings").upsert(payload, { onConflict: "workspace_id" });
	if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/presets", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ currentUserId: undefined, initialTeamId: null, teams: [], teamsWithPresets: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = c.req.query("workspaceId")?.trim() || null;
	const client = getDataClient(c.env);
	const membershipsResult = await client.from("workspace_members").select("workspace_id,teams:workspaces(id,name)").eq("user_id", user.id);
	if (membershipsResult.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const teams = (membershipsResult.data ?? []).flatMap((membership) => {
		const team = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;
		return team?.id && team?.name ? [{ id: team.id, name: team.name }] : [];
	});
	let presets: unknown[] = [];
	if (workspaceId) {
		const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
		if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
		const presetsResult = await context.client.from("presets").select("*").eq("workspace_id", workspaceId).is("archived_at", null).or(`visibility.neq.private,created_by.eq.${user.id}`);
		if (presetsResult.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
		presets = await withPresetLifecycle(context.client, presetsResult.data ?? []).catch(() => presetsResult.data ?? []);
		if (!teams.some((team) => team.id === workspaceId)) {
			const workspaceResult = await context.client.from("workspaces").select("id,name").eq("id", workspaceId).maybeSingle();
			if (workspaceResult.data?.id && workspaceResult.data.name) teams.push({ id: workspaceResult.data.id, name: workspaceResult.data.name });
		}
	}
	const activeTeam = teams.find((team) => team.id === workspaceId);
	return c.json({ currentUserId: user.id, initialTeamId: workspaceId, teams, teamsWithPresets: activeTeam ? [{ ...activeTeam, presets }] : [] }, 200, PRIVATE_NO_STORE_HEADERS);
});

function validPresetName(value: string) { return /^@[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(value.trim()); }
function presetVisibility(value: unknown) { return ["private", "team", "public"].includes(String(value)) ? String(value) : "team"; }
function normalizePresetSlug(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9._:-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-._:]+|[-._:]+$/g, ""); }
function canWritePreset(context: AccountWorkspaceContext, userId: string, preset: { created_by?: string | null; visibility?: string | null }) { return preset.created_by === userId || (preset.visibility !== "private" && ["owner", "admin"].includes(context.role.toLowerCase())); }
async function presetSlugConflict(client: ReturnType<typeof getDataClient>, workspaceId: string, publisherUserId: string, slug: string, visibility: string, excludeId?: string) {
	let scoped = client.from("presets").select("id").eq("workspace_id", workspaceId).eq("slug", slug); if (excludeId) scoped = scoped.neq("id", excludeId);
	const workspace = await scoped.maybeSingle(); if (workspace.error) throw workspace.error; if (workspace.data) return "workspace";
	if (visibility !== "public") return null;
	let global = client.from("presets").select("id").eq("visibility", "public").eq("created_by", publisherUserId).eq("slug", slug); if (excludeId) global = global.neq("id", excludeId);
	const publicResult = await global.maybeSingle(); if (publicResult.error) throw publicResult.error; return publicResult.data ? "public" : null;
}
async function publicPublisher(client: ReturnType<typeof getDataClient>, userId: string) {
	const result = await client.from("users").select("public_profile_enabled,public_profile_slug").eq("user_id", userId).maybeSingle();
	if (result.error) throw result.error;
	const handle = String(result.data?.public_profile_slug ?? "").trim().toLowerCase();
	return result.data?.public_profile_enabled && handle ? handle : null;
}
async function withPresetLifecycle(client: ReturnType<typeof getDataClient>, rows: any[]) {
	const sourceIds = [...new Set(rows.map((row) => String(row.source_preset_id ?? "")).filter(Boolean))];
	const latestBySource = new Map<string, { id: string; version_number: number }>();
	if (sourceIds.length) {
		const versions = await client.from("preset_versions").select("id,preset_id,version_number").in("preset_id", sourceIds).order("version_number", { ascending: false });
		if (versions.error) throw versions.error;
		for (const version of versions.data ?? []) if (!latestBySource.has(String(version.preset_id))) latestBySource.set(String(version.preset_id), { id: String(version.id), version_number: Number(version.version_number) });
	}
	return rows.map((row) => ({ ...row, name: row.draft_name ?? row.name, slug: row.draft_slug ?? row.slug, description: row.draft_description ?? row.description, config: row.draft_config ?? row.config, visibility: row.draft_visibility ?? row.visibility, latestUpstreamVersion: latestBySource.get(String(row.source_preset_id ?? "")) ?? null, hasUpstreamUpdate: Boolean(row.source_preset_id && latestBySource.get(String(row.source_preset_id))?.id !== row.upstream_version_id) }));
}
async function purgePresetCache(c: { executionCtx: object }, id?: string) {
	return purgeWorkerCacheTags(c.executionCtx, ["web-api-marketplace", "web-api-marketplace-presets", ...(id ? [`web-api-marketplace-preset-${encodeURIComponent(id).replace(/%/g, "")}`] : [])]);
}

accountSettingsPolicyRouter.get("/presets/list", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ error: "workspace_required" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const result = await context.client.from("presets").select("*").eq("workspace_id", workspaceId).is("archived_at", null).or(`visibility.neq.private,created_by.eq.${context.user.id}`).order("created_at", { ascending: false });
	if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const presets = await withPresetLifecycle(context.client, result.data ?? []).catch(() => result.data ?? []);
	return c.json({ presets }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.post("/presets", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim(); const name = String(body.name ?? "").trim(); const slug = normalizePresetSlug(body.slug ?? name);
	if (!workspaceId || !validPresetName(name) || !slug) return c.json({ error: "invalid_preset" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const duplicate = await context.client.from("presets").select("id").eq("workspace_id", workspaceId).eq("name", name).maybeSingle();
	if (duplicate.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	if (duplicate.data) return c.json({ error: "duplicate_preset" }, 409, PRIVATE_NO_STORE_HEADERS);
	const visibility = presetVisibility(body.visibility); const publisher = visibility === "public" ? await publicPublisher(context.client, user.id).catch(() => null) : null;
	if (visibility === "public" && !publisher) return c.json({ error: "public_profile_required" }, 409, PRIVATE_NO_STORE_HEADERS);
	const conflict = await presetSlugConflict(context.client, workspaceId, user.id, slug, visibility).catch(() => "error");
	if (conflict === "error") return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	if (conflict) return c.json({ error: conflict === "public" ? "public_slug_conflict" : "duplicate_preset_slug", slug }, 409, PRIVATE_NO_STORE_HEADERS);
	const result = await context.client.from("presets").insert({ workspace_id: workspaceId, name, slug, created_by: user.id, config: body.config && typeof body.config === "object" ? body.config : {}, visibility, ...(body.description ? { description: String(body.description).trim().slice(0, 500) } : {}) }).select("id,created_at").maybeSingle();
	if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const cache = await purgePresetCache(c, result.data?.id);
	return c.json({ id: result.data?.id, name, createdAt: result.data?.created_at, canonicalModel: publisher ? `@${publisher}/${slug}` : `@${slug}`, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/presets/:presetId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = getDataClient(c.env); const result = await client.from("presets").select("*").eq("id", c.req.param("presetId")).maybeSingle();
	if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	if (!result.data) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	if (result.data.workspace_id) { const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: result.data.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ preset: result.data }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.post("/presets/:presetId/fork", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { workspaceId?: string } = await c.req.json<{ workspaceId?: string }>().catch(() => ({})); const workspaceId = String(body.workspaceId ?? "").trim();
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const source = await context.client.from("presets").select("id,name,slug,description,config,visibility,active_version_id").eq("id", c.req.param("presetId")).is("archived_at", null).maybeSingle();
	if (source.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); if (!source.data || source.data.visibility !== "public") return c.json({ error: "not_public" }, 404, PRIVATE_NO_STORE_HEADERS);
	const names = await context.client.from("presets").select("name").eq("workspace_id", workspaceId); if (names.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const existing = new Set((names.data ?? []).map((row) => row.name)); const base = String(source.data.name || "@preset"); let name = base;
	if (existing.has(name)) { name = `${base}-copy`; for (let i = 2; existing.has(name) && i <= 20; i++) name = `${base}-copy-${i}`; }
	if (existing.has(name)) return c.json({ error: "name_unavailable" }, 409, PRIVATE_NO_STORE_HEADERS);
	const baseSlug = normalizePresetSlug(source.data.slug ?? name); let slug = baseSlug; let slugAttempts = 0;
	while (await presetSlugConflict(context.client, workspaceId, user.id, slug, "private")) { slugAttempts += 1; if (slugAttempts > 20) return c.json({ error: "slug_unavailable" }, 409, PRIVATE_NO_STORE_HEADERS); slug = `${baseSlug}-copy${slugAttempts > 1 ? `-${slugAttempts}` : ""}`; }
	const result = await context.client.from("presets").insert({ workspace_id: workspaceId, name, slug, created_by: user.id, config: source.data.config ?? {}, visibility: "private", source_preset_id: source.data.id, source_preset_version_id: source.data.active_version_id, upstream_version_id: source.data.active_version_id, ...(source.data.description ? { description: source.data.description } : {}) }).select("id").maybeSingle();
	if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); const cache = await purgePresetCache(c, source.data.id); if (result.data?.id) await purgePresetCache(c, result.data.id);
	return c.json({ id: result.data?.id, name, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.put("/presets/:presetId", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = getDataClient(c.env); const id = c.req.param("presetId"); const existing = await client.from("presets").select("id,workspace_id,name,slug,config,visibility,created_by,draft_name,draft_slug,draft_description,draft_config,draft_visibility,source_preset_id,upstream_version_id").eq("id", id).maybeSingle();
	if (existing.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); if (!existing.data?.workspace_id) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: existing.data.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!canWritePreset(context, user.id, existing.data)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({})); const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (body.name != null) { const name = String(body.name).trim(); if (!validPresetName(name)) return c.json({ error: "invalid_preset" }, 400, PRIVATE_NO_STORE_HEADERS); update.draft_name = name; }
	if (body.description !== undefined) update.draft_description = body.description ? String(body.description).trim().slice(0, 500) : null;
	if (body.config !== undefined) update.draft_config = body.replaceConfig === true ? (body.config && typeof body.config === "object" ? body.config : {}) : { ...((existing.data.draft_config as Record<string, unknown>) ?? (existing.data.config as Record<string, unknown>) ?? {}), ...(body.config && typeof body.config === "object" ? body.config : {}) };
	if (body.visibility !== undefined) update.draft_visibility = presetVisibility(body.visibility);
	if (body.slug !== undefined) update.draft_slug = normalizePresetSlug(body.slug);
	const nextSlug = String(update.draft_slug ?? existing.data.draft_slug ?? existing.data.slug ?? ""); const nextVisibility = String(update.draft_visibility ?? existing.data.draft_visibility ?? existing.data.visibility); if (!nextSlug) return c.json({ error: "invalid_preset_slug" }, 400, PRIVATE_NO_STORE_HEADERS);
	const publisher = nextVisibility === "public" ? await publicPublisher(client, existing.data.created_by).catch(() => null) : null; if (nextVisibility === "public" && !publisher) return c.json({ error: "public_profile_required" }, 409, PRIVATE_NO_STORE_HEADERS);
	const conflict = await presetSlugConflict(client, existing.data.workspace_id, existing.data.created_by, nextSlug, nextVisibility, id).catch(() => "error"); if (conflict === "error") return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); if (conflict) return c.json({ error: conflict === "public" ? "public_slug_conflict" : "duplicate_preset_slug", slug: nextSlug }, 409, PRIVATE_NO_STORE_HEADERS);
	const result = await client.from("presets").update(update).eq("id", id); if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const cache = await purgePresetCache(c, id); return c.json({ success: true, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/presets/:presetId/versions", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = getDataClient(c.env); const id = c.req.param("presetId");
	const preset = await client.from("presets").select("workspace_id").eq("id", id).maybeSingle();
	if (preset.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); if (!preset.data?.workspace_id) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: preset.data.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const versions = await client.from("preset_versions").select("id,version_number,name,slug,description,visibility,release_notes,created_at").eq("preset_id", id).order("version_number", { ascending: false });
	if (versions.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	return c.json({ versions: versions.data ?? [] }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.post("/presets/:presetId/versions", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = getDataClient(c.env); const id = c.req.param("presetId"); const body: { releaseNotes?: string } = await c.req.json<{ releaseNotes?: string }>().catch(() => ({}));
	const preset = await client.from("presets").select("workspace_id,created_by,draft_visibility").eq("id", id).maybeSingle();
	if (preset.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); if (!preset.data?.workspace_id) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: preset.data.workspace_id }); if (!context || preset.data.created_by !== user.id) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (preset.data.draft_visibility === "public" && !await publicPublisher(client, user.id).catch(() => null)) return c.json({ error: "public_profile_required" }, 409, PRIVATE_NO_STORE_HEADERS);
	const published = await client.rpc("publish_preset_version", { target_preset_id: id, actor_user_id: user.id, notes: String(body.releaseNotes ?? "").slice(0, 1000) });
	if (published.error) return c.json({ error: "version_publish_failed" }, 503, PRIVATE_NO_STORE_HEADERS);
	const version = Array.isArray(published.data) ? published.data[0] : published.data;
	const cache = await purgePresetCache(c, id); return c.json({ version, cache }, 201, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.post("/presets/:presetId/upstream", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = getDataClient(c.env); const id = c.req.param("presetId"); const body: { versionId?: string } = await c.req.json<{ versionId?: string }>().catch(() => ({}));
	const preset = await client.from("presets").select("workspace_id,created_by").eq("id", id).maybeSingle();
	if (preset.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); if (!preset.data?.workspace_id || !body.versionId) return c.json({ error: "invalid_upstream_version" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: preset.data.workspace_id }); if (!context || preset.data.created_by !== user.id) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const applied = await client.rpc("apply_preset_upstream_version", { target_preset_id: id, target_version_id: body.versionId, actor_user_id: user.id });
	if (applied.error) return c.json({ error: "upstream_update_failed" }, 409, PRIVATE_NO_STORE_HEADERS);
	return c.json({ appliedToDraft: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.delete("/presets/:presetId", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = getDataClient(c.env); const id = c.req.param("presetId"); const existing = await client.from("presets").select("name,workspace_id,created_by,visibility").eq("id", id).maybeSingle();
	if (existing.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); if (!existing.data?.workspace_id) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: existing.data.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!canWritePreset(context, user.id, existing.data)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const confirm = c.req.query("confirmName"); if (confirm && confirm !== existing.data.name) return c.json({ error: "confirmation_mismatch" }, 409, PRIVATE_NO_STORE_HEADERS);
	const result = await client.from("presets").update({ archived_at: new Date().toISOString() }).eq("id", id); if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const cache = await purgePresetCache(c, id); return c.json({ success: true, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/guardrails", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ activeProviderModels: [], guardrailKeyIdsByGuardrailId: {}, guardrails: [], keys: [], providers: [], workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const [reference, guardrailsResult] = await Promise.all([
			loadGuardrailReference(context),
			context.client.from("workspace_guardrails").select(GUARDRAIL_COLUMNS).eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
		]);
		if (guardrailsResult.error) throw guardrailsResult.error;
		const guardrails = guardrailsResult.data ?? [];
		const ids = guardrails.map((guardrail) => guardrail.id).filter(Boolean);
		const keyMap = new Map<string, string[]>();
		if (ids.length) {
			const mappingsResult = await context.client.from("key_guardrails").select("guardrail_id,key_id").in("guardrail_id", ids);
			if (mappingsResult.error) throw mappingsResult.error;
			for (const row of mappingsResult.data ?? []) {
				if (!row.guardrail_id || !row.key_id) continue;
				keyMap.set(row.guardrail_id, [...(keyMap.get(row.guardrail_id) ?? []), row.key_id]);
			}
		}
		return c.json({ ...reference, guardrailKeyIdsByGuardrailId: Object.fromEntries(keyMap), guardrails, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch {
		return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountSettingsPolicyRouter.get("/guardrails/editor", async (c) => {
	const mode = c.req.query("mode") === "edit" ? "edit" : "create";
	const guardrailId = c.req.query("guardrailId")?.trim();
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ activeProviderModels: [], guardrail: null, initialKeyIds: [], keys: [], mode, providers: [], teamName: null, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const [reference, guardrailResult] = await Promise.all([
			loadGuardrailReference(context),
			mode === "edit" && guardrailId
				? context.client.from("workspace_guardrails").select(GUARDRAIL_COLUMNS).eq("workspace_id", workspaceId).eq("id", guardrailId).maybeSingle()
				: Promise.resolve({ data: null, error: null }),
		]);
		if (guardrailResult.error) throw guardrailResult.error;
		let initialKeyIds: string[] = [];
		if (mode === "edit" && guardrailResult.data?.id) {
			const mappingsResult = await context.client.from("key_guardrails").select("key_id").eq("guardrail_id", guardrailResult.data.id);
			if (mappingsResult.error) throw mappingsResult.error;
			initialKeyIds = (mappingsResult.data ?? []).map((row) => row.key_id).filter(Boolean);
		}
		return c.json({ ...reference, guardrail: guardrailResult.data ?? null, initialKeyIds, mode, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch {
		return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});
