import { Hono } from "hono";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { requireUser } from "@/auth/requireUser";
import {
	createApiKey,
	createManagementKey,
	deleteApiKey,
	deleteManagementKey,
	findApiKey,
	findManagementKey,
	getKeyCapacity,
	listManagementKeys,
	rotateApiKey,
	updateApiKey,
	updateManagementKey,
} from "@/repositories/settings-keys";
import { requireAccountWorkspace } from "./context";

const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CONTROL_SCOPES = ["me:read","models:read","providers:read","pricing:read","credits:read","activity:read","analytics:read","generations:read","feedback:read","feedback:write","workspaces:read","workspaces:write","workspaces:delete","keys:read","keys:write","keys:delete","presets:read","presets:write","presets:delete","settings:read","settings:write","guardrails:read","guardrails:write","guardrails:delete","management_keys:read","management_keys:write","management_keys:delete","oauth_clients:read","oauth_clients:write","oauth_clients:delete"] as const;

function randomBase62(length: number) {
	const upperBound = 256 - (256 % BASE62.length);
	let value = "";
	while (value.length < length) {
		const bytes = crypto.getRandomValues(new Uint8Array(length - value.length));
		for (const byte of bytes) {
			if (byte < upperBound) value += BASE62[byte % BASE62.length];
		}
	}
	return value;
}
function generateKey(kind: "sk" | "mk") { const kid = randomBase62(12); const secret = randomBase62(40); return { kid, secret, plaintext: `phaseo_v1_${kind}_${kid}_${secret}`, prefix: kid.slice(0, 6) }; }
function buffer(value: Uint8Array) { return new Uint8Array(value).buffer; }
async function hmac(env: Env, secret: string) {
	const pepper = String(env.KEY_PEPPER_ACTIVE ?? "").trim(); if (!pepper) throw new Error("key_pepper_unavailable");
	const key = await crypto.subtle.importKey("raw", buffer(new TextEncoder().encode(pepper)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(secret)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function nonNegative(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0; }
function optionalExpiry(value: unknown): string | null | undefined { if (value === undefined) return undefined; if (value === null || String(value).trim() === "") return null; const date = new Date(String(value)); if (!Number.isFinite(date.getTime())) throw new Error("invalid_expiry"); return date.toISOString(); }
async function enforceKeyLimit(context: NonNullable<Awaited<ReturnType<typeof requireAccountWorkspace>>>, env: Env) {
	const capacity = await getKeyCapacity(env, context.workspaceId);
	if (capacity.tier.toLowerCase() === "enterprise") return;
	const limit = Math.max(1, Number.parseInt(env.NON_ENTERPRISE_KEY_LIMIT ?? "100", 10) || 100);
	if (capacity.count >= limit) throw new Error("key_limit_reached");
}

async function invalidateGatewayKey(env: Env, keyId: string) {
	const key = env.PHASEO_MANAGEMENT_KEY ?? env.PHASEO_CONTROL_KEY; if (!key || !env.PHASEO_CONTROL_SECRET) return;
	await fetch(`${(env.GATEWAY_API_ORIGIN ?? "http://localhost:8787").replace(/\/$/, "")}/v1/keys/${encodeURIComponent(keyId)}/invalidate`, { method: "POST", headers: { authorization: `Bearer ${key}`, "x-control-secret": env.PHASEO_CONTROL_SECRET } });
}

export const accountSettingsKeysRouter = new Hono<{ Bindings: Env }>();

accountSettingsKeysRouter.post("/keys", async (c) => {
	const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({})); const workspaceId = String(body.workspaceId ?? "").trim(); const name = String(body.name ?? "").trim();
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId }); if (!context || !["owner","admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); if (!name) return c.json({ error: "invalid_name" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { await enforceKeyLimit(context, c.env); const key = generateKey("sk"); const result = await createApiKey(c.env, { workspaceId, name, kid: key.kid, hash: await hmac(c.env, key.secret), prefix: key.prefix, status: "active", scopes: typeof body.scopes === "string" ? body.scopes : "[]", createdBy: String(user.id), dailyLimitRequests: nonNegative(body.limits?.dailyRequests), weeklyLimitRequests: nonNegative(body.limits?.weeklyRequests), monthlyLimitRequests: nonNegative(body.limits?.monthlyRequests), dailyLimitCostNanos: nonNegative(body.limits?.dailyCostNanos), weeklyLimitCostNanos: nonNegative(body.limits?.weeklyCostNanos), monthlyLimitCostNanos: nonNegative(body.limits?.monthlyCostNanos) }); return c.json({ id: result?.id, plaintext: key.plaintext, prefix: key.prefix }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch (error) { return c.json({ error: error instanceof Error ? error.message : "key_write_failed" }, 409, PRIVATE_NO_STORE_HEADERS); }
});

async function apiKeyContext(c: any) { const user = await requireUser(c.req.raw, c.env); if (!user) return null; const key = await findApiKey(c.env, c.req.param("keyId")); if (!key?.workspaceId) return null; const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(key.workspaceId) }); if (!context || !["owner","admin"].includes(context.role.toLowerCase())) return null; return { user, context, key }; }

accountSettingsKeysRouter.put("/keys/:keyId", async (c) => { const loaded = await apiKeyContext(c); if (!loaded) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); if (String(loaded.key.status).toLowerCase() === "deleted") return c.json({ error: "key_deleted" }, 409, PRIVATE_NO_STORE_HEADERS); const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({})); const update: Record<string, unknown> = {}; if (typeof body.name === "string") update.name = body.name; if (typeof body.paused === "boolean") update.status = body.paused ? "paused" : "active"; try { await updateApiKey(c.env, String(loaded.key.id), loaded.context.workspaceId, update); } catch { return c.json({ error: "key_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); } if ("status" in update) c.executionCtx.waitUntil(invalidateGatewayKey(c.env, String(loaded.key.id))); return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS); });

accountSettingsKeysRouter.put("/keys/:keyId/limits", async (c) => { const loaded = await apiKeyContext(c); if (!loaded) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({})); const update: Record<string, unknown> = { dailyLimitRequests: nonNegative(body.dailyRequests), weeklyLimitRequests: nonNegative(body.weeklyRequests), monthlyLimitRequests: nonNegative(body.monthlyRequests), dailyLimitCostNanos: nonNegative(body.dailyCostNanos), weeklyLimitCostNanos: nonNegative(body.weeklyCostNanos), monthlyLimitCostNanos: nonNegative(body.monthlyCostNanos) }; if (typeof body.softBlocked === "boolean") update.softBlocked = body.softBlocked; try { await updateApiKey(c.env, String(loaded.key.id), loaded.context.workspaceId, update); } catch { return c.json({ error: "key_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); } c.executionCtx.waitUntil(invalidateGatewayKey(c.env, String(loaded.key.id))); return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS); });

accountSettingsKeysRouter.post("/keys/:keyId/rotate", async (c) => { const loaded = await apiKeyContext(c); if (!loaded) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); if (String(loaded.key.status).toLowerCase() === "deleted") return c.json({ error: "key_deleted" }, 409, PRIVATE_NO_STORE_HEADERS); const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({})); let expires: string | null | undefined; try { expires = optionalExpiry(body.previousKeyExpiresAt); } catch { return c.json({ error: "invalid_expiry" }, 400, PRIVATE_NO_STORE_HEADERS); } const key = generateKey("sk"); try { const inserted = await rotateApiKey(c.env, { workspaceId: loaded.context.workspaceId, name: typeof body.newName === "string" && body.newName.trim() ? body.newName.trim() : `${loaded.key.name} (rotated)`, kid: key.kid, hash: await hmac(c.env, key.secret), prefix: key.prefix, status: "active", scopes: loaded.key.scopes ?? "[]", createdBy: String(loaded.user.id), dailyLimitRequests: nonNegative(loaded.key.dailyLimitRequests), weeklyLimitRequests: nonNegative(loaded.key.weeklyLimitRequests), monthlyLimitRequests: nonNegative(loaded.key.monthlyLimitRequests), dailyLimitCostNanos: nonNegative(loaded.key.dailyLimitCostNanos), weeklyLimitCostNanos: nonNegative(loaded.key.weeklyLimitCostNanos), monthlyLimitCostNanos: nonNegative(loaded.key.monthlyLimitCostNanos), softBlocked: Boolean(loaded.key.softBlocked) }, { id: String(loaded.key.id), expiresAt: expires }); if (expires !== undefined) c.executionCtx.waitUntil(invalidateGatewayKey(c.env, String(loaded.key.id))); return c.json({ id: inserted.id, plaintext: key.plaintext, prefix: key.prefix, previousKeyExpiresAt: expires ?? null }, 200, PRIVATE_NO_STORE_HEADERS); } catch { return c.json({ error: "key_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); } });

accountSettingsKeysRouter.delete("/keys/:keyId", async (c) => { const loaded = await apiKeyContext(c); if (!loaded) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); const confirm = c.req.query("confirmName"); if (confirm && confirm !== loaded.key.name) return c.json({ error: "confirmation_mismatch" }, 409, PRIVATE_NO_STORE_HEADERS); if (String(loaded.key.status).toLowerCase() === "deleted") return c.json({ success: true, alreadyDeleted: true }, 200, PRIVATE_NO_STORE_HEADERS); const keyId = String(loaded.key.id); await invalidateGatewayKey(c.env, keyId); try { await deleteApiKey(c.env, keyId, loaded.context.workspaceId); } catch { return c.json({ error: "key_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); } return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS); });

function templateScopes(template: string) { if (template === "read-only") return CONTROL_SCOPES.filter((scope) => scope.endsWith(":read")); if (template === "read-write") return CONTROL_SCOPES.filter((scope) => /:(read|write)$/.test(scope)); if (template === "full-control") return [...CONTROL_SCOPES]; return null; }
async function managementContext(c: any) { const user = await requireUser(c.req.raw, c.env); if (!user) return null; const key = await findManagementKey(c.env, c.req.param("keyId")); if (!key?.workspaceId) return null; const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(key.workspaceId) }); if (!context || !["owner","admin"].includes(context.role.toLowerCase())) return null; return { user, context, key }; }

accountSettingsKeysRouter.post("/management-keys", async (c) => { const user = await requireUser(c.req.raw, c.env); if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS); const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({})); const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(body.workspaceId ?? "") }); if (!context || !["owner","admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); const scopes = body.template ? templateScopes(String(body.template)) : Array.isArray(body.scopes) ? body.scopes.filter((scope: unknown) => CONTROL_SCOPES.includes(scope as any)) : null; if (!scopes?.length) return c.json({ error: "invalid_scopes" }, 400, PRIVATE_NO_STORE_HEADERS); try { await enforceKeyLimit(context, c.env); const key = generateKey("mk"); const result = await createManagementKey(c.env, { workspaceId: context.workspaceId, name: String(body.name ?? "").trim(), kid: key.kid, hash: await hmac(c.env, key.secret), prefix: key.prefix, status: "active", scopes: JSON.stringify(scopes), expiresAt: optionalExpiry(body.expiresAt) ?? null, createdBy: String(user.id), createdAt: new Date().toISOString() }); return c.json({ id: result?.id, plaintext: key.plaintext, prefix: key.prefix, createdAt: result?.createdAt }, 200, PRIVATE_NO_STORE_HEADERS); } catch (error) { return c.json({ error: error instanceof Error ? error.message : "key_write_failed" }, 409, PRIVATE_NO_STORE_HEADERS); } });

accountSettingsKeysRouter.get("/management-keys", async (c) => { const workspaceId = c.req.query("workspaceId")?.trim(); const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId }); if (!context || !["owner","admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); try { return c.json({ keys: await listManagementKeys(c.env, context.workspaceId) }, 200, PRIVATE_NO_STORE_HEADERS); } catch { return c.json({ error: "key_read_failed" }, 503, PRIVATE_NO_STORE_HEADERS); } });
accountSettingsKeysRouter.get("/management-keys/:keyId", async (c) => { const loaded = await managementContext(c); if (!loaded) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); return c.json({ key: loaded.key }, 200, PRIVATE_NO_STORE_HEADERS); });
accountSettingsKeysRouter.put("/management-keys/:keyId", async (c) => { const loaded = await managementContext(c); if (!loaded) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); const body: Record<string, any> = await c.req.json<Record<string, any>>().catch(() => ({})); const update: Record<string, unknown> = {}; if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim(); if (typeof body.paused === "boolean") update.status = body.paused ? "paused" : "active"; try { const expiry = optionalExpiry(body.expiresAt); if (expiry !== undefined) update.expiresAt = expiry; } catch { return c.json({ error: "invalid_expiry" }, 400, PRIVATE_NO_STORE_HEADERS); } if (body.template) { const scopes = templateScopes(String(body.template)); if (!scopes) return c.json({ error: "invalid_scopes" }, 400, PRIVATE_NO_STORE_HEADERS); update.scopes = JSON.stringify(scopes); } if (body.limits) { const p = body.limits; Object.assign(update, { softBlocked: typeof p.softBlocked === "boolean" ? p.softBlocked : undefined }); } try { await updateManagementKey(c.env, String(loaded.key.id), loaded.context.workspaceId, update); } catch { return c.json({ error: "key_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); } return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS); });
accountSettingsKeysRouter.delete("/management-keys/:keyId", async (c) => { const loaded = await managementContext(c); if (!loaded) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS); const confirm = c.req.query("confirmName"); if (confirm && confirm !== loaded.key.name) return c.json({ error: "confirmation_mismatch" }, 409, PRIVATE_NO_STORE_HEADERS); try { await deleteManagementKey(c.env, String(loaded.key.id), loaded.context.workspaceId); } catch { return c.json({ error: "key_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); } return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS); });
