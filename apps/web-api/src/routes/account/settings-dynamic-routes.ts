import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { createDynamicRoute, deleteDynamicRoute, deployDynamicRouteVersion, findDynamicRoute, listDynamicRouteSettings, replaceDynamicRouteKeys, updateDynamicRoute } from "@/repositories/dynamic-routes";
import { requireAccountWorkspace } from "./context";

const MODES = new Set(["balanced", "price", "latency", "throughput"]);
const FIELDS = new Set(["always", "endpoint", "model", "session_id", "metadata"]);
const OPERATORS = new Set(["equals", "not_equals", "contains", "starts_with", "exists"]);
const NODE_TYPES = new Set(["start", "condition", "percentage", "model", "rate_limit", "budget_limit", "end"]);

function text(value: unknown, max: number): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	return normalized ? normalized.slice(0, max) : null;
}

function providers(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.map((item) => text(item, 128)).filter((item): item is string => Boolean(item)))].slice(0, 64);
}

function models(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.map((item) => text(item, 256)).filter((item): item is string => Boolean(item)))].slice(0, 8);
}

function action(value: unknown) {
	const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
	const mode = text(raw.routingMode, 32);
	return {
		...(text(raw.model, 256) ? { model: text(raw.model, 256) } : {}),
		modelFallbacks: models(raw.modelFallbacks),
		...(mode && MODES.has(mode) ? { routingMode: mode } : {}),
		providerOrder: providers(raw.providerOrder),
		providerOnly: providers(raw.providerOnly),
		providerIgnore: providers(raw.providerIgnore),
		allowFallbacks: raw.allowFallbacks !== false,
	};
}

function slug(value: unknown, fallback: string): string {
	return (text(value, 63) ?? fallback)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63) || `route-${crypto.randomUUID().slice(0, 8)}`;
}

function graph(value: Record<string, unknown>) {
	const nodes = (Array.isArray(value.nodes) ? value.nodes : []).slice(0, 64).flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const node = entry as Record<string, any>;
		const id = text(node.id, 80);
		const type = text(node.type, 32);
		if (!id || !type || !NODE_TYPES.has(type)) return [];
		const position = node.position && typeof node.position === "object" ? { x: Math.max(-10_000, Math.min(10_000, Number(node.position.x) || 0)), y: Math.max(-10_000, Math.min(10_000, Number(node.position.y) || 0)) } : null;
		const data = node.data && typeof node.data === "object" && !Array.isArray(node.data) ? node.data : {};
		return [{ id, type, position, data }];
	});
	const nodeIds = new Set(nodes.map((node) => node.id));
	const edges = (Array.isArray(value.edges) ? value.edges : []).slice(0, 128).flatMap((entry, index) => {
		if (!entry || typeof entry !== "object") return [];
		const edge = entry as Record<string, unknown>;
		const source = text(edge.source, 80);
		const target = text(edge.target, 80);
		if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return [];
		return [{ id: text(edge.id, 100) ?? `${source}-${target}-${index}`, source, target, sourceHandle: text(edge.sourceHandle, 80) }];
	});
	const requestedEntry = text(value.entryNodeId, 80);
	return { schemaVersion: 2, entryNodeId: requestedEntry && nodeIds.has(requestedEntry) ? requestedEntry : nodes.find((node) => node.type === "start")?.id ?? nodes[0]?.id ?? null, nodes, edges };
}

function routeConfig(value: unknown) {
	const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
	const rules = (Array.isArray(raw.rules) ? raw.rules : []).slice(0, 32).flatMap((entry, index) => {
		if (!entry || typeof entry !== "object") return [];
		const rule = entry as Record<string, unknown>;
		const condition = rule.condition && typeof rule.condition === "object" ? rule.condition as Record<string, unknown> : {};
		const field = text(condition.field, 32) ?? "always";
		const operator = text(condition.operator, 32) ?? (field === "always" ? "exists" : "equals");
		if (!FIELDS.has(field) || !OPERATORS.has(operator)) return [];
		return [{
			id: text(rule.id, 80) ?? crypto.randomUUID(),
			name: text(rule.name, 120) ?? `Rule ${index + 1}`,
			enabled: rule.enabled !== false,
			condition: {
				field,
				operator,
				value: text(condition.value, 512),
				metadataKey: text(condition.metadataKey, 128),
			},
			action: action(rule.action),
		}];
	});
	return {
		...(Array.isArray(raw.nodes) ? graph(raw) : {}),
		cacheAwareRouting: raw.cacheAwareRouting !== false,
		sessionAffinity: raw.sessionAffinity !== false,
		defaultAction: action(raw.defaultAction),
		rules,
	};
}

function isAdmin(role: string): boolean {
	return role === "owner" || role === "admin";
}

async function invalidateGatewayKey(env: Env, keyId: string) {
	const key = env.PHASEO_MANAGEMENT_KEY ?? env.PHASEO_CONTROL_KEY;
	if (!key || !env.PHASEO_CONTROL_SECRET) return;
	await fetch(`${(env.GATEWAY_API_ORIGIN ?? "http://localhost:8787").replace(/\/$/, "")}/v1/keys/${encodeURIComponent(keyId)}/invalidate`, {
		method: "POST",
		headers: { authorization: `Bearer ${key}`, "x-control-secret": env.PHASEO_CONTROL_SECRET },
	});
}

async function invalidateKeys(c: any, keyIds: string[]) {
	await Promise.allSettled([...new Set(keyIds)].map((keyId) => invalidateGatewayKey(c.env, keyId)));
}

export const accountSettingsDynamicRoutesRouter = new Hono<{ Bindings: Env }>();

accountSettingsDynamicRoutesRouter.get("/dynamic-routes", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ workspaceId: null, routes: [], keys: [], providers: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let data; try { data = await listDynamicRouteSettings(c.env, workspaceId); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const routeIds = new Set(data.routes.map((route) => String(route.id)));
	const versionsByRoute = new Map<string, any[]>();
	for (const version of data.versions) {
		const routeId = String(version.routeId); if (!routeIds.has(routeId)) continue;
		versionsByRoute.set(routeId, [...(versionsByRoute.get(routeId) ?? []), version]);
	}
	const keyIdsByRoute = new Map<string, string[]>();
	for (const row of data.links) {
		const routeId = String(row.routeId); if (!routeIds.has(routeId)) continue;
		keyIdsByRoute.set(routeId, [...(keyIdsByRoute.get(routeId) ?? []), String(row.keyId)]);
	}
	return c.json({
		workspaceId,
		routes: data.routes.map((route) => {
			const routeId = String(route.id); const versions = versionsByRoute.get(routeId) ?? [];
			const latest = versions[0];
			return {
				...route, workspace_id: route.workspaceId, deployed_version: route.deployedVersion, created_at: route.createdAt, updated_at: route.updatedAt,
				config: latest?.config ?? route.config,
				keyIds: keyIdsByRoute.get(routeId) ?? [],
				versions: versions.map((item) => ({ version: item.version, status: item.version === route.deployedVersion ? "deployed" : item.version === route.version ? "draft" : "superseded", created_at: item.createdAt, created_by: item.createdBy })),
			};
		}),
		keys: data.availableKeys,
		providers: data.providers.map((provider) => ({
			id: provider.id,
			name: provider.name ?? provider.id,
			status: provider.status,
			routingStatus: provider.routingEnabled ? "active" : "disabled",
		})),
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsDynamicRoutesRouter.post("/dynamic-routes", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const workspaceId = text(body.workspaceId, 80);
	const name = text(body.name, 80);
	if (!workspaceId || !name) return c.json({ error: "invalid_route" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context || !isAdmin(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const config = routeConfig(body.config);
	try { const route = await createDynamicRoute(c.env, { workspaceId, name, slug: slug(body.slug, name), description: text(body.description, 500), status: body.status === "paused" ? "paused" : "active", config, userId: String(user.id) }); return c.json({ route: { id: route.id, name, version: route.version ?? 1, createdAt: route.createdAt } }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch (error) { const duplicate = /unique/i.test(String(error)); return c.json({ error: duplicate ? "duplicate_route" : "route_write_failed" }, duplicate ? 409 : 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsDynamicRoutesRouter.put("/dynamic-routes/:routeId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const routeId = c.req.param("routeId");
	const existing = await findDynamicRoute(c.env, routeId);
	if (!existing?.workspaceId) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(existing.workspaceId) });
	if (!context || !isAdmin(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const update: Record<string, unknown> = {};
	if (body.name !== undefined) { const name = text(body.name, 80); if (!name) return c.json({ error: "invalid_route" }, 400, PRIVATE_NO_STORE_HEADERS); update.name = name; }
	if (body.description !== undefined) update.description = text(body.description, 500);
	if (body.status !== undefined) update.status = body.status === "paused" ? "paused" : "active";
	const config = routeConfig(body.config);
	try { const version = await updateDynamicRoute(c.env, routeId, context.workspaceId, String(user.id), config, update as any); if (!version) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS); return c.json({ success: true, version }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "route_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsDynamicRoutesRouter.post("/dynamic-routes/:routeId/versions/:version/deploy", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const routeId = c.req.param("routeId");
	const version = Number(c.req.param("version"));
	if (!Number.isInteger(version) || version < 1) return c.json({ error: "invalid_version" }, 400, PRIVATE_NO_STORE_HEADERS);
	const route = await findDynamicRoute(c.env, routeId);
	if (!route?.workspaceId) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(route.workspaceId) });
	if (!context || !isAdmin(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let keyIds; try { keyIds = await deployDynamicRouteVersion(c.env, routeId, context.workspaceId, version); } catch { return c.json({ error: "route_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (!keyIds) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	c.executionCtx.waitUntil(invalidateKeys(c, keyIds));
	return c.json({ success: true, deployedVersion: version }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsDynamicRoutesRouter.put("/dynamic-routes/:routeId/keys", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const routeId = c.req.param("routeId");
	const route = await findDynamicRoute(c.env, routeId);
	if (!route?.workspaceId) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(route.workspaceId) });
	if (!context || !isAdmin(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: { keyIds?: unknown } = await c.req.json<{ keyIds?: unknown }>().catch(() => ({}));
	const keyIds = providers(body.keyIds);
	let replaced; try { replaced = await replaceDynamicRouteKeys(c.env, { routeId, workspaceId: context.workspaceId, keyIds, userId: String(user.id) }); } catch { return c.json({ error: "route_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (replaced.status === "invalid_keys") return c.json({ error: "invalid_keys" }, 409, PRIVATE_NO_STORE_HEADERS);
	const invalidated = [...replaced.previous, ...keyIds];
	c.executionCtx.waitUntil(invalidateKeys(c, invalidated));
	return c.json({ success: true, keyIds }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsDynamicRoutesRouter.delete("/dynamic-routes/:routeId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const routeId = c.req.param("routeId");
	const route = await findDynamicRoute(c.env, routeId);
	if (!route?.workspaceId) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(route.workspaceId) });
	if (!context || !isAdmin(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const confirm = c.req.query("confirmName");
	if (confirm && confirm !== route.name) return c.json({ error: "confirmation_mismatch" }, 409, PRIVATE_NO_STORE_HEADERS);
	let keyIds; try { keyIds = await deleteDynamicRoute(c.env, routeId, context.workspaceId); } catch { return c.json({ error: "route_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	c.executionCtx.waitUntil(invalidateKeys(c, keyIds));
	return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
});
