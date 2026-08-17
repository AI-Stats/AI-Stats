import { Hono } from "hono";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { createWorkspaceGuardrail, deleteWorkspaceGuardrail, listActiveWorkspaceKeyIds, replaceGuardrailKeys, replaceGuardrailMembers, updateWorkspaceGuardrail, upsertGlobalGuardrail, validateRoutableModels } from "@/repositories/guardrails";
import { requireAccountWorkspace } from "./context";

type GuardrailPayload = Record<string, any>;

function guardrailRow(payload: GuardrailPayload, includeName = true): Record<string, unknown> {
	const row: Record<string, unknown> = { updatedAt: new Date().toISOString() };
	if (includeName) {
		const name = String(payload.name ?? "").trim();
		if (!name) throw new Error("Name is required");
		row.name = name;
		row.description = payload.description ?? null;
		row.enabled = payload.enabled ?? true;
	}
	const fields: Array<[string, string]> = [
		["privacyEnablePaidMayTrain", "privacyEnablePaidMayTrain"],
		["privacyEnableFreeMayTrain", "privacyEnableFreeMayTrain"],
		["privacyEnableFreeMayPublishPrompts", "privacyEnableFreeMayPublishPrompts"],
		["privacyEnableInputOutputLogging", "privacyEnableInputOutputLogging"],
		["privacyZdrOnly", "privacyZdrOnly"],
		["providerRestrictionMode", "providerRestrictionMode"],
		["providerRestrictionProviderIds", "providerRestrictionProviderIds"],
		["providerRestrictionEnforceAllowed", "providerRestrictionEnforceAllowed"],
		["modelRestrictionMode", "modelRestrictionMode"],
		["modelRestrictionModelIds", "modelRestrictionModelIds"],
		["allowedApiModelIds", "allowedApiModelIds"],
		["promptInjectionEnabled", "promptInjectionEnabled"],
		["promptInjectionAction", "promptInjectionAction"],
		["sensitiveInfoEnabled", "sensitiveInfoEnabled"],
		["sensitiveInfoDefaultAction", "sensitiveInfoDefaultAction"],
		["sensitiveInfoRules", "sensitiveInfoRules"],
	];
	for (const [input, column] of fields) if (payload[input] !== undefined) row[column] = payload[input];
	const ioLoggingUpdated =
		typeof payload.ioLoggingEnabled === "boolean" ||
		typeof payload.ioLoggingRetentionDays === "number" ||
		typeof payload.ioLoggingIncludeProviderPayloads === "boolean";
	if (typeof payload.ioLoggingEnabled === "boolean") {
		row.ioLoggingEnabled = payload.ioLoggingEnabled;
	}
	if (typeof payload.ioLoggingRetentionDays === "number") {
		row.ioLoggingRetentionDays = Math.max(
			90,
			Math.min(365, Math.trunc(payload.ioLoggingRetentionDays)),
		);
	}
	if (typeof payload.ioLoggingIncludeProviderPayloads === "boolean") {
		row.ioLoggingIncludeProviderPayloads =
			payload.ioLoggingIncludeProviderPayloads;
	}
	if (ioLoggingUpdated) row.ioLoggingUpdatedAt = row.updatedAt;
	if (includeName) {
		const budgets = payload.budgets ?? {};
		Object.assign(row, {
			dailyLimitRequests: budgets.dailyRequests ?? 0,
			weeklyLimitRequests: budgets.weeklyRequests ?? 0,
			monthlyLimitRequests: budgets.monthlyRequests ?? 0,
			dailyLimitCostNanos: budgets.dailyCostNanos ?? 0,
			weeklyLimitCostNanos: budgets.weeklyCostNanos ?? 0,
			monthlyLimitCostNanos: budgets.monthlyCostNanos ?? 0,
		});
	}
	if (includeName) {
		delete row.modelRestrictionModelIds;
		delete row.ioLoggingEnabled;
		delete row.ioLoggingRetentionDays;
		delete row.ioLoggingIncludeProviderPayloads;
		delete row.ioLoggingUpdatedAt;
	} else {
		delete row.allowedApiModelIds;
		delete row.promptInjectionEnabled;
		delete row.promptInjectionAction;
		delete row.sensitiveInfoEnabled;
		delete row.sensitiveInfoDefaultAction;
		delete row.sensitiveInfoRules;
	}
	return row;
}

async function adminContext(c: any, workspaceId: unknown) {
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: String(workspaceId ?? "") });
	return context && ["owner", "admin"].includes(context.role.toLowerCase()) ? context : null;
}

export const accountSettingsGuardrailsRouter = new Hono<{ Bindings: Env }>();

async function invalidateWorkspaceKeys(c: any, context: any): Promise<void> {
	const keyIds = await listActiveWorkspaceKeyIds(c.env, context.workspaceId).catch(() => []);
	const origin = String(c.env.GATEWAY_API_ORIGIN ?? "http://localhost:8787").replace(/\/$/, "");
	const controlKey = c.env.PHASEO_CONTROL_KEY;
	const controlSecret = c.env.PHASEO_CONTROL_SECRET;
	if (!controlKey || !controlSecret) return;
	await Promise.allSettled(keyIds.map((keyId) => fetch(`${origin}/v1/keys/${encodeURIComponent(keyId)}/invalidate`, {
		method: "POST",
		headers: { authorization: `Bearer ${controlKey}`, "x-control-secret": controlSecret },
	})));
}

function scheduleInvalidation(c: any, context: any): void {
	c.executionCtx.waitUntil(invalidateWorkspaceKeys(c, context));
}

accountSettingsGuardrailsRouter.put("/guardrails/global", async (c) => {
	const body: GuardrailPayload = await c.req.json<GuardrailPayload>().catch(() => ({}));
	const context = await adminContext(c, body.workspaceId);
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const requestedModels = Array.isArray(body.modelRestrictionModelIds)
			? [...new Set(body.modelRestrictionModelIds.map(String).map((value) => value.trim()).filter(Boolean))]
			: [];
		if (requestedModels.length) {
			if (!await validateRoutableModels(c.env, requestedModels)) {
				return c.json({ error: "invalid_route_restriction" }, 400, PRIVATE_NO_STORE_HEADERS);
			}
			body.modelRestrictionModelIds = requestedModels;
		}
		await upsertGlobalGuardrail(c.env, context.workspaceId, guardrailRow(body, false) as any);
		scheduleInvalidation(c, context);
		return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) { return c.json({ error: error instanceof Error ? error.message : "guardrail_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsGuardrailsRouter.post("/guardrails", async (c) => {
	const body: GuardrailPayload = await c.req.json<GuardrailPayload>().catch(() => ({}));
	const context = await adminContext(c, body.workspaceId);
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const result = await createWorkspaceGuardrail(c.env, { workspaceId: context.workspaceId, ...guardrailRow(body) } as any);
		scheduleInvalidation(c, context);
		return c.json({ id: result?.id }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) { return c.json({ error: error instanceof Error ? error.message : "guardrail_write_failed" }, 409, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsGuardrailsRouter.put("/guardrails/:guardrailId", async (c) => {
	const body: GuardrailPayload = await c.req.json<GuardrailPayload>().catch(() => ({}));
	const context = await adminContext(c, body.workspaceId);
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		await updateWorkspaceGuardrail(c.env, c.req.param("guardrailId"), context.workspaceId, guardrailRow(body) as any);
		scheduleInvalidation(c, context);
		return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) { return c.json({ error: error instanceof Error ? error.message : "guardrail_write_failed" }, 409, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsGuardrailsRouter.delete("/guardrails/:guardrailId", async (c) => {
	const body: GuardrailPayload = await c.req.json<GuardrailPayload>().catch(() => ({}));
	const context = await adminContext(c, body.workspaceId);
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { await deleteWorkspaceGuardrail(c.env, c.req.param("guardrailId"), context.workspaceId); }
	catch { return c.json({ error: "guardrail_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	scheduleInvalidation(c, context);
	return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsGuardrailsRouter.put("/guardrails/:guardrailId/keys", async (c) => {
	const body: GuardrailPayload = await c.req.json<GuardrailPayload>().catch(() => ({}));
	const context = await adminContext(c, body.workspaceId);
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const guardrailId = c.req.param("guardrailId");
	const keyIds = Array.isArray(body.keyIds) ? [...new Set(body.keyIds.map(String).filter(Boolean))] : [];
	let result; try { result = await replaceGuardrailKeys(c.env, { guardrailId, workspaceId: context.workspaceId, keyIds }); }
	catch { return c.json({ error: "guardrail_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (result === "guardrail_not_found") return c.json({ error: "Guardrail not found" }, 404, PRIVATE_NO_STORE_HEADERS);
	if (result === "invalid_keys") return c.json({ error: "One or more keys do not belong to this workspace" }, 409, PRIVATE_NO_STORE_HEADERS);
	scheduleInvalidation(c, context);
	return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsGuardrailsRouter.put("/guardrails/:guardrailId/members", async (c) => {
	const body: GuardrailPayload = await c.req.json<GuardrailPayload>().catch(() => ({}));
	const context = await adminContext(c, body.workspaceId);
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const guardrailId = c.req.param("guardrailId");
	const userIds = Array.isArray(body.userIds) ? [...new Set(body.userIds.map(String).filter(Boolean))] : [];
	let result; try { result = await replaceGuardrailMembers(c.env, { guardrailId, workspaceId: context.workspaceId, userIds }); }
	catch { return c.json({ error: "guardrail_write_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (result === "guardrail_not_found") return c.json({ error: "Guardrail not found" }, 404, PRIVATE_NO_STORE_HEADERS);
	if (result === "invalid_members") return c.json({ error: "One or more users do not belong to this workspace" }, 409, PRIVATE_NO_STORE_HEADERS);
	scheduleInvalidation(c, context);
	return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
});
