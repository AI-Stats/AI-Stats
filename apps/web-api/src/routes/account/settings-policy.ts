import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import { applyPresetUpstreamVersion, archivePreset, createPreset, forkPreset, getPreset, getPresetAccess, getPresetWorkspacePublisher, listPresetVersions, listPresetWorkspaces, listWorkspacePresets, publishPresetVersion, renamePublisherHandle, updatePresetDraft } from "@/repositories/preset-policy";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { requireAccountWorkspace, type AccountWorkspaceContext } from "./context";
import { purgeWorkerCacheTags } from "@/http/invalidation";
import { getEffectiveGuardrailPolicy, getRoutingPolicySettings, listActiveWorkspaceKeyIds, loadGuardrailEditorData, loadGuardrailReferenceData, loadGuardrailSettings, saveRoutingPolicySettings } from "@/repositories/guardrails";

function accountPolicyFromRow(row: any) {
	const mode = (value: unknown) => value === "allowlist" || value === "blocklist" ? value : "none";
	const ids = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
	return {
		privacyEnablePaidMayTrain: (row?.privacy_enable_paid_may_train ?? row?.privacyEnablePaidMayTrain) !== false,
		privacyEnableFreeMayTrain: (row?.privacy_enable_free_may_train ?? row?.privacyEnableFreeMayTrain) !== false,
		privacyEnableInputOutputLogging: (row?.privacy_enable_input_output_logging ?? row?.privacyEnableInputOutputLogging) !== false,
		privacyZdrOnly: (row?.privacy_zdr_only ?? row?.privacyZdrOnly) === true,
		providerRestrictionMode: mode(row?.provider_restriction_mode ?? row?.providerRestrictionMode),
		providerRestrictionProviderIds: ids(row?.provider_restriction_provider_ids ?? row?.providerRestrictionProviderIds),
		modelRestrictionMode: mode(row?.model_restriction_mode ?? row?.modelRestrictionMode),
		modelRestrictionModelIds: ids(row?.model_restriction_model_ids ?? row?.modelRestrictionModelIds),
	};
}

async function invalidateGatewayKey(env: Env, keyId: string): Promise<void> {
	const key = env.PHASEO_CONTROL_KEY;
	if (!key || !env.PHASEO_CONTROL_SECRET) throw new Error("gateway_invalidation_unavailable");
	const response = await fetch(
		`${(env.GATEWAY_API_ORIGIN ?? "http://localhost:8787").replace(/\/$/, "")}/v1/keys/${encodeURIComponent(keyId)}/invalidate`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${key}`,
				"x-control-secret": env.PHASEO_CONTROL_SECRET,
			},
		},
	);
	if (!response.ok) throw new Error("gateway_invalidation_failed");
}

async function invalidateWorkspaceGatewayContext(
	workspaceId: string,
	env: Env,
): Promise<boolean> {
	const keyIds = await listActiveWorkspaceKeyIds(env, workspaceId);
	if (!keyIds.length) return true;
	if (!env.PHASEO_CONTROL_KEY || !env.PHASEO_CONTROL_SECRET) return false;
	await Promise.all(keyIds.map((id) => invalidateGatewayKey(env, id)));
	return true;
}

export const accountSettingsPolicyRouter = new Hono<{ Bindings: Env }>();

function restriction(mode: unknown, ids: unknown) {
	return {
		mode: mode === "allowlist" || mode === "blocklist" ? mode : "none",
		ids: Array.isArray(ids) ? ids.map((id) => String(id ?? "").trim()).filter(Boolean) : [],
	};
}

accountSettingsPolicyRouter.get("/chat/effective-policy", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ account: null, guardrails: [], workspace: null, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let policy; try { policy = await getEffectiveGuardrailPolicy(c.env, { workspaceId, userId: context.user.id }); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const normalize = (row: any, modelIdsKey = "modelRestrictionModelIds") => ({
		provider: restriction(row?.providerRestrictionMode, row?.providerRestrictionProviderIds),
		model: restriction(row?.modelRestrictionMode, row?.[modelIdsKey]),
	});
	return c.json({
		account: normalize(policy.account),
		workspace: normalize(policy.workspace),
		guardrails: policy.guardrails.map((row: any) => ({ id: String(row.id), name: String(row.name ?? "Guardrail"), ...normalize(row, "allowedApiModelIds") })),
		workspaceId,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/routing", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ responseHealingEnabled: false, responseHealingLocked: false, responseHealingMode: "safe", routingMode: "balanced", teamName: null, alphaChannelEnabled: false, betaChannelEnabled: false, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let source; try { source = await getRoutingPolicySettings(c.env, workspaceId); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({
		responseHealingEnabled: Boolean(source.settings?.responseHealingEnabled),
		responseHealingLocked: Boolean(source.settings?.responseHealingLocked),
		responseHealingMode: source.settings?.responseHealingMode === "strict" ? "strict" : "safe",
		routingMode: source.settings?.routingMode ?? "balanced",
		teamName: source.workspace?.name ?? null,
		alphaChannelEnabled: Boolean(source.settings?.alphaChannelEnabled),
		betaChannelEnabled: Boolean(source.settings?.betaChannelEnabled),
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
	const payload: Record<string, unknown> = { routingMode: mode, updatedAt: new Date().toISOString() };
	if (typeof body.betaChannelEnabled === "boolean") payload.betaChannelEnabled = body.betaChannelEnabled;
	if (typeof body.alphaChannelEnabled === "boolean") payload.alphaChannelEnabled = body.betaChannelEnabled === false ? false : body.alphaChannelEnabled;
	if (typeof body.responseHealingEnabled === "boolean") payload.responseHealingEnabled = body.responseHealingEnabled;
	if (typeof body.responseHealingLocked === "boolean") payload.responseHealingLocked = body.responseHealingLocked;
	if (body.responseHealingMode === "safe" || body.responseHealingMode === "strict") payload.responseHealingMode = body.responseHealingMode;
	try { await saveRoutingPolicySettings(c.env, workspaceId, payload); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	let gatewayCacheInvalidated = false;
	try {
		gatewayCacheInvalidated = await invalidateWorkspaceGatewayContext(workspaceId, c.env);
	} catch {
		gatewayCacheInvalidated = false;
	}
	return c.json({ ok: true, gatewayCacheInvalidated }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/presets", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ currentUserId: undefined, initialTeamId: null, workspacePublisher: { handle: null, canManage: false }, teams: [], teamsWithPresets: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = c.req.query("workspaceId")?.trim() || null;
	let teams; try { teams = await listPresetWorkspaces(c.env, user.id); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	let presets: unknown[] = [];
	let workspacePublisher: { handle: string | null; canManage: boolean } = { handle: null, canManage: false };
	if (workspaceId) {
		const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
		if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
		try { presets = await listWorkspacePresets(c.env, { workspaceId, userId: user.id }); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
		presets = presets.map((preset: any) => ({ ...preset, canPublish: canWritePreset(context, user.id, { ...preset, visibility: preset.published_visibility ?? preset.visibility }) }));
		if (!teams.some((team) => team.id === workspaceId)) {
			const workspace = (await listPresetWorkspaces(c.env, user.id)).find((row) => row.id === workspaceId); if (workspace) teams.push(workspace);
		}
		try { workspacePublisher = {
			handle: await getPresetWorkspacePublisher(c.env, workspaceId),
			canManage: ["owner", "admin"].includes(context.role.toLowerCase()),
		}; } catch { /* retain unavailable publisher fallback */ }
	}
	const activeTeam = teams.find((team) => team.id === workspaceId);
	return c.json({ currentUserId: user.id, initialTeamId: workspaceId, workspacePublisher, teams, teamsWithPresets: activeTeam ? [{ ...activeTeam, presets }] : [] }, 200, PRIVATE_NO_STORE_HEADERS);
});

function validPresetName(value: string) {
	const normalized = value.trim();
	return normalized.length > 0 && normalized.length <= 120 && !/\p{C}/u.test(normalized);
}
function presetVisibility(value: unknown) { return ["private", "team", "public"].includes(String(value)) ? String(value) : "team"; }
function normalizePresetSlug(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9._:-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-._:]+|[-._:]+$/g, ""); }
function canWritePreset(context: AccountWorkspaceContext, userId: string, preset: { created_by?: string | null; visibility?: string | null }) { return preset.created_by === userId || (preset.visibility !== "private" && ["owner", "admin"].includes(context.role.toLowerCase())); }
function presetHasDraftChanges(row: any) {
	return row.draft_name !== row.name
		|| row.draft_slug !== row.slug
		|| row.draft_description !== row.description
		|| JSON.stringify(row.draft_config) !== JSON.stringify(row.config)
		|| row.draft_visibility !== row.visibility;
}
async function purgePresetCache(c: { executionCtx: object }, id?: string) {
	return purgeWorkerCacheTags(c.executionCtx, ["web-api-marketplace", "web-api-marketplace-presets", ...(id ? [`web-api-marketplace-preset-${encodeURIComponent(id).replace(/%/g, "")}`] : [])]);
}

accountSettingsPolicyRouter.get("/presets/list", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ error: "workspace_required" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let presets; try { presets = await listWorkspacePresets(c.env, { workspaceId, userId: context.user.id }); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	for (const preset of presets) preset.canPublish = canWritePreset(context, context.user.id, { ...preset, visibility: preset.published_visibility ?? preset.visibility });
	return c.json({ presets }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.put("/presets/publisher", async (c) => {
	const body: { workspaceId?: string; handle?: string } = await c.req.json<{ workspaceId?: string; handle?: string }>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim();
	const handle = String(body.handle ?? "").trim().toLowerCase();
	if (!workspaceId || !/^[a-z0-9][a-z0-9_-]{2,39}$/.test(handle)) return c.json({ error: "invalid_publisher_handle" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let renamed; try { renamed = await renamePublisherHandle(c.env, { workspaceId, userId: String(context.user.id), handle }); }
	catch (error) { if (String(error).includes("publisher_handle_reserved")) return c.json({ error: "publisher_handle_conflict" }, 409, PRIVATE_NO_STORE_HEADERS); return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	await Promise.all([
		purgeWorkerCacheTags(c.executionCtx, ["web-api-marketplace", "web-api-marketplace-presets"]),
		invalidateWorkspaceGatewayContext(workspaceId, c.env).catch(() => false),
	]);
	return c.json({ handle: renamed }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.post("/presets", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim(); const name = String(body.name ?? "").trim(); const slug = normalizePresetSlug(body.slug ?? name);
	if (!workspaceId || !validPresetName(name) || !slug) return c.json({ error: "invalid_preset" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const visibility = presetVisibility(body.visibility);
	let result; try { result = await createPreset(c.env, { workspaceId, userId: user.id, name, slug, description: body.description ? String(body.description).trim().slice(0, 500) : null, config: body.config && typeof body.config === "object" ? body.config : {}, visibility }); }
	catch (error) { const message=String(error); if(message.includes("duplicate_preset_slug")) return c.json({error:"duplicate_preset_slug",slug},409,PRIVATE_NO_STORE_HEADERS); if(message.includes("duplicate_preset")) return c.json({error:"duplicate_preset"},409,PRIVATE_NO_STORE_HEADERS); if(message.includes("workspace_publisher_required")) return c.json({error:"workspace_publisher_required"},409,PRIVATE_NO_STORE_HEADERS); return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS); }
	const publisher = visibility === "public" ? await getPresetWorkspacePublisher(c.env, workspaceId) : null;
	const cache = await purgePresetCache(c, result.id);
	return c.json({ id: result.id, name, createdAt: result.createdAt, canonicalModel: publisher ? `@${publisher}/${slug}` : `@${slug}`, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/presets/:presetId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	let preset; try { preset = await getPreset(c.env, c.req.param("presetId")); } catch { return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS); }
	if (!preset) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: preset.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	return c.json({ preset }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.post("/presets/:presetId/fork", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { workspaceId?: string; sourceVersionId?: string } = await c.req.json<{ workspaceId?: string; sourceVersionId?: string }>().catch(() => ({})); const workspaceId = String(body.workspaceId ?? "").trim();
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let result; try { result = await forkPreset(c.env, { presetId: c.req.param("presetId"), sourceVersionId: body.sourceVersionId, workspaceId, userId: user.id, normalizeSlug: normalizePresetSlug }); }
	catch(error){const message=String(error);if(message.includes("not_public"))return c.json({error:"not_public"},404,PRIVATE_NO_STORE_HEADERS);if(message.includes("invalid_source_version"))return c.json({error:"invalid_source_version"},400,PRIVATE_NO_STORE_HEADERS);if(message.includes("name_unavailable")||message.includes("slug_unavailable"))return c.json({error:message.includes("name_")?"name_unavailable":"slug_unavailable"},409,PRIVATE_NO_STORE_HEADERS);return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
	const cache = await purgePresetCache(c, result.sourceId); await purgePresetCache(c, result.id);
	return c.json({ id: result.id, name: result.name, slug: result.slug, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.put("/presets/:presetId", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const id = c.req.param("presetId"); let existing; try { existing=await getPresetAccess(c.env,id); } catch{return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);} if(!existing)return c.json({error:"not_found"},404,PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: existing.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!canWritePreset(context, user.id, existing)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({})); const update: Record<string, unknown> = {};
	if (body.name != null) { const name = String(body.name).trim(); if (!validPresetName(name)) return c.json({ error: "invalid_preset" }, 400, PRIVATE_NO_STORE_HEADERS); update.draftName = name; }
	if (body.description !== undefined) update.draftDescription = body.description ? String(body.description).trim().slice(0, 500) : null;
	if (body.config !== undefined) update.draftConfig = body.replaceConfig === true ? (body.config && typeof body.config === "object" ? body.config : {}) : { ...((existing.draft_config as Record<string, unknown>) ?? (existing.config as Record<string, unknown>) ?? {}), ...(body.config && typeof body.config === "object" ? body.config : {}) };
	if (body.visibility !== undefined) update.draftVisibility = presetVisibility(body.visibility);
	if (body.slug !== undefined) update.draftSlug = normalizePresetSlug(body.slug);
	if (["sequential", "semver", "date"].includes(String(body.versioningMethod))) update.versioningMethod = String(body.versioningMethod);
	const nextSlug = String(update.draftSlug ?? existing.draft_slug ?? existing.slug ?? ""); const nextVisibility = String(update.draftVisibility ?? existing.draft_visibility ?? existing.visibility); if (!nextSlug) return c.json({ error: "invalid_preset_slug" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { await updatePresetDraft(c.env,{presetId:id,workspaceId:existing.workspace_id,slug:nextSlug,values:update,requirePublisher:nextVisibility==="public"}); } catch(error){const message=String(error);if(message.includes("workspace_publisher_required"))return c.json({error:"workspace_publisher_required"},409,PRIVATE_NO_STORE_HEADERS);if(message.includes("duplicate_preset_slug"))return c.json({error:"duplicate_preset_slug",slug:nextSlug},409,PRIVATE_NO_STORE_HEADERS);return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
	const cache = await purgePresetCache(c, id); return c.json({ success: true, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/presets/:presetId/versions", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const id = c.req.param("presetId"); let preset; try{preset=await getPresetAccess(c.env,id);}catch{return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);} if(!preset)return c.json({error:"not_found"},404,PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: preset.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (preset.visibility === "private" && preset.created_by !== user.id) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	try{return c.json({versions:await listPresetVersions(c.env,id)},200,PRIVATE_NO_STORE_HEADERS);}catch{return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
});

accountSettingsPolicyRouter.post("/presets/:presetId/versions", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const id = c.req.param("presetId"); const body: { releaseNotes?: string; versionLabel?: string } = await c.req.json<{ releaseNotes?: string; versionLabel?: string }>().catch(() => ({}));
	let preset;try{preset=await getPresetAccess(c.env,id);}catch{return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}if(!preset)return c.json({error:"not_found"},404,PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: preset.workspace_id }); if (!context || !canWritePreset(context, user.id, preset)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!presetHasDraftChanges(preset)) return c.json({ error: "no_draft_changes" }, 409, PRIVATE_NO_STORE_HEADERS);
	if (preset.draft_visibility === "public" && !await getPresetWorkspacePublisher(c.env, preset.workspace_id).catch(() => null)) return c.json({ error: "workspace_publisher_required" }, 409, PRIVATE_NO_STORE_HEADERS);
	let version; try { version = await publishPresetVersion(c.env, { presetId: id, userId: String(user.id), notes: String(body.releaseNotes ?? "").slice(0, 1000), requestedLabel: body.versionLabel ? String(body.versionLabel).slice(0, 100) : null }); }
	catch (error) {
		const message = String(error);
		if (message.includes("invalid_semver_label")) return c.json({ error: "invalid_semver_label" }, 400, PRIVATE_NO_STORE_HEADERS);
		if (message.includes("preset_not_found")) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
		if (message.includes("preset_publish_forbidden")) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
		return c.json({ error: "version_publish_failed" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
	const cache = await purgePresetCache(c, id); return c.json({ version, cache }, 201, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.post("/presets/:presetId/upstream", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const id = c.req.param("presetId"); const body: { versionId?: string } = await c.req.json<{ versionId?: string }>().catch(() => ({}));
	let preset;try{preset=await getPresetAccess(c.env,id);}catch{return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}if(!preset||!body.versionId)return c.json({error:"invalid_upstream_version"},400,PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: preset.workspace_id }); if (!context || preset.created_by !== user.id) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { await applyPresetUpstreamVersion(c.env, { presetId: id, versionId: body.versionId, userId: String(user.id) }); }
	catch (error) {
		const message = String(error);
		if (message.includes("preset_has_local_draft_changes")) return c.json({ error: "preset_has_local_draft_changes" }, 409, PRIVATE_NO_STORE_HEADERS);
		if (message.includes("upstream_preset_not_public") || message.includes("upstream_version_not_public") || message.includes("upstream_version_not_found")) return c.json({ error: "upstream_version_unavailable" }, 409, PRIVATE_NO_STORE_HEADERS);
		return c.json({ error: "upstream_update_failed" }, 409, PRIVATE_NO_STORE_HEADERS);
	}
	return c.json({ appliedToDraft: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.delete("/presets/:presetId", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const id = c.req.param("presetId");let existing;try{existing=await getPreset(c.env,id);}catch{return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}if(!existing)return c.json({error:"not_found"},404,PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: existing.workspace_id }); if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!canWritePreset(context, user.id, existing)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const confirm = c.req.query("confirmName"); if (confirm && confirm !== existing.name) return c.json({ error: "confirmation_mismatch" }, 409, PRIVATE_NO_STORE_HEADERS);
	try{await archivePreset(c.env,id);}catch{return c.json({error:"settings_unavailable"},503,PRIVATE_NO_STORE_HEADERS);}
	const cache = await purgePresetCache(c, id); return c.json({ success: true, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsPolicyRouter.get("/guardrails", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ activeProviderModels: [], guardrailKeyIdsByGuardrailId: {}, guardrailMemberIdsByGuardrailId: {}, guardrails: [], keys: [], members: [], providers: [], workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const [reference, settings] = await Promise.all([loadGuardrailReferenceData(c.env, workspaceId), loadGuardrailSettings(c.env, workspaceId)]);
		return c.json({ ...reference, ...settings, canManageGuardrails: ["owner", "admin"].includes(context.role.toLowerCase()), workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch {
		return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountSettingsPolicyRouter.get("/guardrails/editor", async (c) => {
	const mode = c.req.query("mode") === "edit" ? "edit" : "create";
	const guardrailId = c.req.query("guardrailId")?.trim();
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ accountPolicy: accountPolicyFromRow(null), activeProviderModels: [], guardrail: null, initialKeyIds: [], initialMemberIds: [], keys: [], members: [], mode, providers: [], teamName: null, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const [reference, editor] = await Promise.all([loadGuardrailReferenceData(c.env, workspaceId), loadGuardrailEditorData(c.env, {workspaceId,userId:context.user.id,guardrailId:mode==="edit"?guardrailId:undefined})]);
		return c.json({ ...reference, canManageGuardrails: ["owner", "admin"].includes(context.role.toLowerCase()), accountPolicy: accountPolicyFromRow(editor.account), guardrail: editor.guardrail, initialKeyIds: editor.initialKeyIds, initialMemberIds: editor.initialMemberIds, mode, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch {
		return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});
