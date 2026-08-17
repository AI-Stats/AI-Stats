import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { getAccountProfile } from "@/repositories/account-auth";
import { createCreditGrant, deleteCreditGrant, getCreditTierSummary, getWalletBalance, listCreditGrants, listCreditWorkspaces, redeemCreditGrant, saveWorkspaceNotifications, updateCreditGrant, updateWalletTopUp } from "@/repositories/credits";
import { requireAccountWorkspace } from "./context";

const EMPTY_TIER_SUMMARY = { lastMonthCents: 0, mtdCents: 0, teamTier: "basic" as const };

export function parseLowBalanceThresholdNanos(value: unknown): number | null {
	const thresholdUsd = Number(value);
	const thresholdNanos = Math.round(thresholdUsd * 1_000_000_000);
	const hasAtMostTwoDecimalPlaces = Math.abs(thresholdUsd * 100 - Math.round(thresholdUsd * 100)) < 1e-8;
	if (!Number.isFinite(thresholdUsd) || thresholdUsd < 0 || !hasAtMostTwoDecimalPlaces || !Number.isSafeInteger(thresholdNanos)) return null;
	return thresholdNanos;
}

function nanosToCredits(value: unknown): number | null {
	const nanos = Number(value ?? 0);
	return Number.isFinite(nanos) ? nanos / 1_000_000_000 : null;
}

function cookieValue(request: Request, name: string): string | null {
	const cookieHeader = request.headers.get("cookie") ?? "";
	for (const segment of cookieHeader.split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 0) continue;
		const key = segment.slice(0, separator).trim();
		if (key !== name) continue;
		const value = segment.slice(separator + 1).trim();
		try {
			return decodeURIComponent(value) || null;
		} catch {
			return value || null;
		}
	}
	return null;
}

async function requireWorkspace(c: { req: { raw: Request; query: (key: string) => string | undefined }; env: Env }) {
	const user = await requireUser(c.req.raw, c.env);
	const workspaceId = c.req.query("workspaceId")?.trim()
		?? cookieValue(c.req.raw, "activeWorkspaceId")?.trim();
	if (!user || !workspaceId) return null;
	return requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
}

async function requireAdmin(request: Request, env: Env) {
	const user = await requireUser(request, env); if (!user) return null;
	const profile = await getAccountProfile(env, user.id); return String(profile?.role ?? "").toLowerCase() === "admin" ? user : null;
}

export const creditsRouter = new Hono<{ Bindings: Env }>();

creditsRouter.get("/redeem-initial", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ activeWorkspaceId: null, invoiceTeamIds: [], signedIn: false, teamOptions: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	let workspaces; try { workspaces = await listCreditWorkspaces(c.env, user.id); } catch { return c.json({ error: "redeem_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const teamOptions: Array<{ id: string; name: string }> = [];
	const invoiceTeamIds: string[] = [];
	for (const team of workspaces) {
		const id = String(team.id ?? "").trim();
		if (!id || teamOptions.some((entry) => entry.id === id)) continue;
		teamOptions.push({ id, name: String(team?.name ?? "Team").trim() || "Team" });
		if (String(team.billingMode ?? "wallet").toLowerCase() === "invoice") invoiceTeamIds.push(id);
	}
	const requested = String(c.req.query("workspaceId") ?? "").trim();
	if (requested && !teamOptions.some((entry) => entry.id === requested)) teamOptions.unshift({ id: requested, name: "Current Team" });
	return c.json({ activeWorkspaceId: requested || null, invoiceTeamIds, signedIn: true, teamOptions }, 200, PRIVATE_NO_STORE_HEADERS);
});

creditsRouter.get("/admin/grants", async (c) => {
	const user = await requireAdmin(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	try { return c.json({ grants: await listCreditGrants(c.env) }, 200, PRIVATE_NO_STORE_HEADERS); } catch { return c.json({ error: "credit_grants_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

creditsRouter.post("/admin/grants", async (c) => {
	const user = await requireAdmin(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const code = String(body.code ?? "").trim().toUpperCase();
	const amountNanos = Number(body.amount_nanos);
	const maxRedemptions = Math.trunc(Number(body.max_redemptions));
	if (!/^[A-Z0-9_-]{2,}$/.test(code) || !Number.isFinite(amountNanos) || amountNanos <= 0 || !Number.isFinite(maxRedemptions) || maxRedemptions <= 0) return c.json({ error: "invalid_grant" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { const outcome = await createCreditGrant(c.env, { code, codeNormalized: code, amountNanos: Math.round(amountNanos), maxRedemptions, expiresAt: body.expires_at ? String(body.expires_at) : null, isActive: true, createdBy: user.id, note: body.note ? String(body.note) : null }); if (outcome === "active") return c.json({ error: "credit_grant_active" }, 409, PRIVATE_NO_STORE_HEADERS); if (outcome === "history") return c.json({ error: "credit_grant_has_history" }, 409, PRIVATE_NO_STORE_HEADERS); return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS); } catch { return c.json({ error: "credit_grant_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

creditsRouter.put("/admin/grants/:grantId", async (c) => {
	const user = await requireAdmin(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const maxRedemptions = Math.max(1, Math.trunc(Number(body.max_redemptions) || 1));
	const redemptionsCount = Math.min(Math.max(0, Math.trunc(Number(body.redemptions_count) || 0)), maxRedemptions);
	const isActive = body.is_active === true;
	try { await updateCreditGrant(c.env, c.req.param("grantId"), { maxRedemptions, redemptionsCount, expiresAt: body.expires_at ? String(body.expires_at) : null, note: body.note ? String(body.note) : null, isActive, disabledAt: isActive ? null : new Date().toISOString() }); } catch { return c.json({ error: "credit_grant_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

creditsRouter.post("/admin/grants/:grantId/disable", async (c) => {
	const user = await requireAdmin(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	try { await updateCreditGrant(c.env, c.req.param("grantId"), { isActive: false, disabledAt: new Date().toISOString() }); } catch { return c.json({ error: "credit_grant_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

creditsRouter.delete("/admin/grants/:grantId", async (c) => {
	const user = await requireAdmin(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const grantId = c.req.param("grantId");
	try { if (!await deleteCreditGrant(c.env, grantId)) return c.json({ error: "credit_grant_has_history" }, 409, PRIVATE_NO_STORE_HEADERS); } catch { return c.json({ error: "credit_grant_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

creditsRouter.get("/balance", async (c) => {
	const context = await requireWorkspace(c);
	if (!context) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	try {
		return c.json({ initialBalance: nanosToCredits(await getWalletBalance(c.env, context.workspaceId)) }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account] credits balance failed", { workspaceId: context.workspaceId, error });
		return c.json({ initialBalance: null }, 200, PRIVATE_NO_STORE_HEADERS);
	}
});

creditsRouter.get("/tier-summary", async (c) => {
	const context = await requireWorkspace(c);
	if (!context) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	try {
		const summary = await getCreditTierSummary(c.env, context.workspaceId);
		return c.json({
			// The existing web components consume nanodollars despite these legacy field names.
			lastMonthCents: Number(summary.previous_nanos ?? 0),
			mtdCents: Number(summary.mtd_nanos ?? 0),
			teamTier: String(summary.tier ?? "").toLowerCase() === "enterprise" ? "enterprise" : "basic",
		}, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account] credits tier summary failed", { workspaceId: context.workspaceId, error });
		return c.json(EMPTY_TIER_SUMMARY, 200, PRIVATE_NO_STORE_HEADERS);
	}
});

creditsRouter.put("/auto-top-up", async (c) => {
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim();
	const context = await requireWorkspace({ req: { raw: c.req.raw, query: (key) => key === "workspaceId" ? workspaceId : undefined }, env: c.env });
	if (!context) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const enabled = body.enabled !== false;
	const topUpAmount = Number(body.topUpAmount ?? 0);
	if (enabled && (!Number.isFinite(topUpAmount) || topUpAmount < 1_000_000_000)) return c.json({ error: "minimum_top_up" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { const data = await updateWalletTopUp(c.env, workspaceId, enabled ? { autoTopUpEnabled: true, lowBalanceThreshold: Number(body.balanceThreshold ?? 0), autoTopUpAmount: topUpAmount, autoTopUpAccountId: body.paymentMethodId == null ? null : String(body.paymentMethodId) } : { autoTopUpEnabled: false, lowBalanceThreshold: 0, autoTopUpAmount: 0, autoTopUpAccountId: null }); return c.json({ data }, 200, PRIVATE_NO_STORE_HEADERS); } catch { return c.json({ error: "credits_update_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

creditsRouter.put("/low-balance-alert", async (c) => {
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim();
	const context = await requireWorkspace({ req: { raw: c.req.raw, query: (key) => key === "workspaceId" ? workspaceId : undefined }, env: c.env });
	if (!context) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const enabled = body.enabled === true;
	const thresholdNanos = parseLowBalanceThresholdNanos(body.thresholdUsd);
	if (enabled && thresholdNanos == null) return c.json({ error: "invalid_threshold" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { await saveWorkspaceNotifications(c.env, workspaceId, { lowBalanceEmailEnabled: enabled, lowBalanceEmailThresholdNanos: enabled ? thresholdNanos : 0 }); } catch { return c.json({ error: "credits_update_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

creditsRouter.put("/notification-preferences", async (c) => {
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim();
	const context = await requireWorkspace({ req: { raw: c.req.raw, query: (key) => key === "workspaceId" ? workspaceId : undefined }, env: c.env });
	if (!context) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const update: Parameters<typeof saveWorkspaceNotifications>[2] = {};
	if (typeof body.autoTopUpFailure === "boolean") update.autoTopUpFailureEmailEnabled = body.autoTopUpFailure;
	if (typeof body.paymentMethodExpiring === "boolean") update.paymentMethodExpiringEmailEnabled = body.paymentMethodExpiring;
	if (!("autoTopUpFailureEmailEnabled" in update) && !("paymentMethodExpiringEmailEnabled" in update)) return c.json({ error: "invalid_preferences" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { await saveWorkspaceNotifications(c.env, workspaceId, update); } catch { return c.json({ error: "credits_update_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

creditsRouter.post("/redeem", async (c) => {
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim();
	const code = String(body.code ?? "").trim().toUpperCase();
	if (!/^[A-Z0-9_-]{2,}$/.test(code)) return c.json({ status: "invalid_code_format", message: "Credit code format is invalid." }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireWorkspace({ req: { raw: c.req.raw, query: (key) => key === "workspaceId" ? workspaceId : undefined }, env: c.env });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { return c.json({ result: await redeemCreditGrant(c.env, { userId: context.user.id, workspaceId, code }) }, 200, PRIVATE_NO_STORE_HEADERS); } catch { return c.json({ status: "error", message: "We could not redeem that credit code right now." }, 503, PRIVATE_NO_STORE_HEADERS); }
});
