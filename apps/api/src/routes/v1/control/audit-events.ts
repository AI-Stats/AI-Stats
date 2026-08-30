import { Hono } from "hono";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { getSupabaseAdmin } from "@/runtime/env";
import type { Env } from "@/runtime/types";
import { json, withRuntime } from "@/routes/utils";
import { internalServerError, requireCapability, requireOAuthWorkspaceRole } from "./route-helpers";

const AUDIT_COLUMNS = "id,workspace_id,actor_user_id,action,target_type,target_id,target_name,metadata,request_id,created_at";

function parseLimit(value: string | null): number {
	const parsed = Number.parseInt(value ?? "50", 10);
	return Math.min(100, Math.max(1, Number.isFinite(parsed) ? parsed : 50));
}

function parseCursor(value: string | null): { createdAt: string; id: string } | null {
	if (!value) return null;
	const separator = value.lastIndexOf("|");
	if (separator <= 0) return null;
	const createdAt = value.slice(0, separator);
	const id = value.slice(separator + 1);
	const isTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt)
		&& Number.isFinite(Date.parse(createdAt));
	const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
	return isTimestamp && isUuid ? { createdAt, id } : null;
}

async function handleListAuditEvents(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.ACTIVITY_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const url = new URL(req.url);
	const rawCursor = url.searchParams.get("cursor");
	const cursor = parseCursor(rawCursor);
	if (rawCursor && !cursor) return json({ error: "bad_request", message: "Invalid audit cursor" }, 400, { "Cache-Control": "no-store" });
	const limit = parseLimit(url.searchParams.get("limit"));
	const action = url.searchParams.get("action")?.trim();
	const targetType = url.searchParams.get("target_type")?.trim();

	try {
		const supabase = getSupabaseAdmin();
		let query = supabase.from("workspace_audit_events").select(AUDIT_COLUMNS)
			.eq("workspace_id", auth.value.workspaceId)
			.order("created_at", { ascending: false })
			.order("id", { ascending: false })
			.limit(limit + 1);
		if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
		if (action) query = query.eq("action", action.slice(0, 100));
		if (targetType) query = query.eq("target_type", targetType.slice(0, 60));
		const { data, error } = await query;
		if (error) throw error;

		const rows = data ?? [];
		const page = rows.slice(0, limit);
		const actorIds = Array.from(new Set(page.map((row) => row.actor_user_id).filter(Boolean)));
		const actorsResult = actorIds.length
			? await supabase.from("users").select("user_id,display_name,email").in("user_id", actorIds)
			: { data: [], error: null };
		if (actorsResult.error) throw actorsResult.error;
		const actors = new Map((actorsResult.data ?? []).map((actor) => [actor.user_id, {
			display_name: actor.display_name ?? null,
			email: actor.email ?? null,
		}]));
		const last = page.at(-1);

		return json({
			data: page.map((row) => ({ ...row, actor: row.actor_user_id ? actors.get(row.actor_user_id) ?? null : null })),
			has_more: rows.length > limit,
			next_cursor: rows.length > limit && last ? `${last.created_at}|${last.id}` : null,
		}, 200, { "Cache-Control": "no-store" });
	} catch (error) {
		return internalServerError("audit_events.list", error);
	}
}

export const auditEventsRoutes = new Hono<Env>();

auditEventsRoutes.get("/", withRuntime(handleListAuditEvents));
