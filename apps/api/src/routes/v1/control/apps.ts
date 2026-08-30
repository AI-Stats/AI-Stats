import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "@/runtime/types";
import { getSupabaseAdmin } from "@/runtime/env";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { recordWorkspaceAuditEvent } from "@/lib/audit/workspaceAudit";
import { json, withRuntime } from "@/routes/utils";
import { isResponse, requireCapability, requireJsonBody, requireOAuthWorkspaceRole } from "./route-helpers";

const NO_STORE = { "Cache-Control": "no-store" };
const INTERNAL_TITLES = new Set(["phaseo chat", "phaseo playground", "ai stats chat", "ai stats playground"]);
const INTERNAL_PREFIXES = ["phaseo-chat", "phaseo-playground", "ai-stats-chat", "aistats-chat", "ai-stats-playground", "aistats-playground"];

async function authorize(req: Request, write: boolean) {
	const auth = await guardManagementAuth(req, { useKvCache: false }); if (!auth.ok) return { response: (auth as GuardErr).response };
	const capability = requireCapability(auth.value, write ? CAPABILITIES.SETTINGS_WRITE : CAPABILITIES.SETTINGS_READ); if (capability) return { response: capability };
	const role = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, write ? ["owner", "admin"] : ["owner", "admin", "member"]); if (role) return { response: role };
	return { auth: auth.value };
}
async function audit(auth: any, action: string, targetId: string, metadata?: Record<string, unknown>) { await recordWorkspaceAuditEvent(getSupabaseAdmin(), { workspaceId: auth.workspaceId, actorUserId: auth.userId, action, targetType: "gateway_app", targetId, metadata, requestId: auth.requestId }); }
function isInternalApp(title: unknown, key: unknown) { const normalizedTitle = String(title ?? "").trim().toLowerCase(); const normalizedKey = String(key ?? "").trim().toLowerCase(); return INTERNAL_TITLES.has(normalizedTitle) || INTERNAL_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix)); }
function isChatApp(title: unknown, key: unknown) { const normalizedTitle = String(title ?? "").trim().toLowerCase(); const normalizedKey = String(key ?? "").trim().toLowerCase(); return ["phaseo chat", "ai stats chat"].includes(normalizedTitle) || ["phaseo-chat", "ai-stats-chat", "aistats-chat"].some((prefix) => normalizedKey.startsWith(prefix)); }
function categories(value: unknown) { if (typeof value !== "string") return null; const normalized = [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 12); return normalized.length ? normalized.join(",") : null; }
function appId(req: Request) { const parts = new URL(req.url).pathname.split("/").filter(Boolean); const merge = parts.at(-1) === "merge"; return decodeURIComponent(parts.at(merge ? -2 : -1) ?? "").trim(); }
function optionalUrl(value: unknown, field: string) { if (value === null || value === "") return null; if (typeof value !== "string") return undefined; let parsed: URL; try { parsed = new URL(value.trim()); } catch { throw new Error(`${field}_invalid`); } if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${field}_invalid`); return parsed.toString(); }

async function purgeAppCaches(context: Context<{ Bindings: Env["Bindings"] }> | undefined, appIds: string[]) {
	const cache = (context?.executionCtx as { cache?: { purge(options: { tags: string[] }): Promise<unknown> } } | undefined)?.cache;
	if (!cache) return;
	const tags = ["web-api-apps", "web-api-app-ids", "web-api-app-images", "web-api-app-rankings", "web-api-landing", ...appIds.map((id) => `web-api-app-${encodeURIComponent(id).replace(/%/g, "")}`)];
	await cache.purge({ tags: [...new Set(tags)] });
}

export function normalizeAppUpdate(body: Record<string, unknown>) {
	const supported = new Set(["title", "url", "docs_url", "image_url", "is_public", "is_active", "category"]);
	if (Object.keys(body).some((field) => !supported.has(field))) return { error: "unsupported_field" };
	const update: Record<string, unknown> = {};
	if (body.title !== undefined) { if (typeof body.title !== "string") return { error: "title_invalid" }; const title = body.title.trim(); if (!title || title.length > 120) return { error: "title_invalid" }; update.title = title; }
	if (body.url !== undefined) { const urlValue = body.url; if (urlValue === null) update.url = "about:blank"; else if (typeof urlValue !== "string") return { error: "url_invalid" }; else if (!urlValue.trim()) update.url = "about:blank"; else { try { update.url = optionalUrl(urlValue, "url"); } catch (error: any) { return { error: error.message }; } } }
	for (const field of ["docs_url", "image_url"] as const) if (body[field] !== undefined) { if (body[field] !== null && typeof body[field] !== "string") return { error: `${field}_invalid` }; try { update[field] = optionalUrl(body[field], field); } catch (error: any) { return { error: error.message }; } }
	if (body.is_public !== undefined) { if (typeof body.is_public !== "boolean") return { error: "is_public_invalid" }; update.is_public = body.is_public; }
	if (body.is_active !== undefined) { if (typeof body.is_active !== "boolean") return { error: "is_active_invalid" }; update.is_active = body.is_active; }
	if (Object.prototype.hasOwnProperty.call(body, "category")) { if (body.category !== null && typeof body.category !== "string") return { error: "category_invalid" }; update.category = categories(body.category); }
	return Object.keys(update).length ? { value: update } : { error: "update_required" };
}

async function listApps(req: Request) {
	const access = await authorize(req, false); if ("response" in access) return access.response;
	const url = new URL(req.url); const offset = Number(url.searchParams.get("offset") ?? "0"); const limit = Number(url.searchParams.get("limit") ?? "100");
	if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) return json({ error: "bad_request", message: "Invalid pagination" }, 400, NO_STORE);
	const { data, error, count } = await getSupabaseAdmin().from("api_apps").select("id,title,app_key,category,docs_url,url,image_url,is_public,is_active,last_seen,created_at", { count: "exact" }).eq("workspace_id", access.auth.workspaceId).order("last_seen", { ascending: false }).range(offset, offset + limit - 1);
	if (error) return json({ error: "apps_unavailable" }, 503, NO_STORE);
	const apps = (data ?? []).filter((app: any) => !isInternalApp(app.title, app.app_key) || isChatApp(app.title, app.app_key)).map((app: any) => ({ ...app, category: categories(app.category) ?? (isChatApp(app.title, app.app_key) ? "chat,productivity" : null), is_managed: isInternalApp(app.title, app.app_key), url: isChatApp(app.title, app.app_key) ? "https://phaseo.app/chat" : app.url ?? null }));
	return json({ data: apps, total_count: count ?? apps.length, offset, limit }, 200, NO_STORE);
}

async function updateApp(req: Request, context?: Context<{ Bindings: Env["Bindings"] }>) {
	const access = await authorize(req, true); if ("response" in access) return access.response; const body = await requireJsonBody(req); if (isResponse(body)) return body; const id = appId(req); const client = getSupabaseAdmin();
	const existing = await client.from("api_apps").select("id,title,app_key,meta").eq("id", id).eq("workspace_id", access.auth.workspaceId).maybeSingle(); if (existing.error) return json({ error: "apps_unavailable" }, 503, NO_STORE); if (!existing.data) return json({ error: "not_found" }, 404, NO_STORE); if (isInternalApp(existing.data.title, existing.data.app_key)) return json({ error: "managed_app" }, 403, NO_STORE);
	const normalized = normalizeAppUpdate(body); if ("error" in normalized) return json({ error: "bad_request", message: normalized.error }, 400, NO_STORE);
	const existingMeta = existing.data.meta && typeof existing.data.meta === "object" && !Array.isArray(existing.data.meta) ? existing.data.meta as Record<string, unknown> : {};
	const previousOverrides = Array.isArray(existingMeta.management_overrides) ? existingMeta.management_overrides.map(String) : [];
	const meta = { ...existingMeta, management_overrides: [...new Set([...previousOverrides, ...Object.keys(normalized.value)])] };
	const { data, error } = await client.from("api_apps").update({ ...normalized.value, meta }).eq("id", id).eq("workspace_id", access.auth.workspaceId).select("id,title,app_key,category,docs_url,url,image_url,is_public,is_active,last_seen,created_at").maybeSingle(); if (error) return json({ error: "app_update_failed" }, 503, NO_STORE); if (!data) return json({ error: "not_found" }, 404, NO_STORE);
	await purgeAppCaches(context, [id]);
	await audit(access.auth, "apps.updated", id, { fields: Object.keys(normalized.value) }); return json({ data: { ...data, is_managed: false } }, 200, NO_STORE);
}

async function mergeApps(req: Request, context?: Context<{ Bindings: Env["Bindings"] }>) {
	const access = await authorize(req, true); if ("response" in access) return access.response; const body = await requireJsonBody(req); if (isResponse(body)) return body; const sourceId = appId(req); const targetId = String(body.target_app_id ?? "").trim(); if (!targetId || targetId === sourceId) return json({ error: "bad_request", message: "A different target_app_id is required" }, 400, NO_STORE);
	const client = getSupabaseAdmin(); const apps = await client.from("api_apps").select("id,title,app_key").eq("workspace_id", access.auth.workspaceId).in("id", [sourceId, targetId]); if (apps.error) return json({ error: "apps_unavailable" }, 503, NO_STORE); if ((apps.data ?? []).length !== 2) return json({ error: "not_found" }, 404, NO_STORE); if ((apps.data ?? []).some((app: any) => isInternalApp(app.title, app.app_key))) return json({ error: "managed_app" }, 403, NO_STORE);
	const result = await client.rpc("merge_v2_gateway_app_history", { p_workspace_id: access.auth.workspaceId, p_source_app_id: sourceId, p_target_app_id: targetId }); if (result.error) return json({ error: "app_merge_failed" }, 503, NO_STORE);
	await purgeAppCaches(context, [sourceId, targetId]);
	await audit(access.auth, "apps.merged", sourceId, { target_app_id: targetId }); return json({ data: { source_app_id: sourceId, target_app_id: targetId, merged: true } }, 200, NO_STORE);
}

export const appRoutes = new Hono<Env>();
appRoutes.get("/", withRuntime(listApps)); appRoutes.patch("/:id", withRuntime(updateApp)); appRoutes.post("/:id/merge", withRuntime(mergeApps));
