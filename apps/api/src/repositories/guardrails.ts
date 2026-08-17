import { keyGuardrails, keys, workspaceGuardrails, workspaceMemberGuardrails, workspaceMembers } from "@phaseo/db/schema";
import { and, desc, eq, inArray, ne } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const selection = {
	id: workspaceGuardrails.id, workspace_id: workspaceGuardrails.workspaceId,
	name: workspaceGuardrails.name, description: workspaceGuardrails.description, enabled: workspaceGuardrails.enabled,
	privacy_enable_paid_may_train: workspaceGuardrails.privacyEnablePaidMayTrain,
	privacy_enable_free_may_train: workspaceGuardrails.privacyEnableFreeMayTrain,
	privacy_enable_free_may_publish_prompts: workspaceGuardrails.privacyEnableFreeMayPublishPrompts,
	privacy_enable_input_output_logging: workspaceGuardrails.privacyEnableInputOutputLogging,
	privacy_zdr_only: workspaceGuardrails.privacyZdrOnly,
	provider_restriction_mode: workspaceGuardrails.providerRestrictionMode,
	provider_restriction_provider_ids: workspaceGuardrails.providerRestrictionProviderIds,
	provider_restriction_enforce_allowed: workspaceGuardrails.providerRestrictionEnforceAllowed,
	model_restriction_mode: workspaceGuardrails.modelRestrictionMode,
	allowed_api_model_ids: workspaceGuardrails.allowedApiModelIds,
	prompt_injection_enabled: workspaceGuardrails.promptInjectionEnabled,
	prompt_injection_action: workspaceGuardrails.promptInjectionAction,
	sensitive_info_enabled: workspaceGuardrails.sensitiveInfoEnabled,
	sensitive_info_default_action: workspaceGuardrails.sensitiveInfoDefaultAction,
	sensitive_info_rules: workspaceGuardrails.sensitiveInfoRules,
	daily_limit_requests: workspaceGuardrails.dailyLimitRequests,
	weekly_limit_requests: workspaceGuardrails.weeklyLimitRequests,
	monthly_limit_requests: workspaceGuardrails.monthlyLimitRequests,
	daily_limit_cost_nanos: workspaceGuardrails.dailyLimitCostNanos,
	weekly_limit_cost_nanos: workspaceGuardrails.weeklyLimitCostNanos,
	monthly_limit_cost_nanos: workspaceGuardrails.monthlyLimitCostNanos,
	created_at: workspaceGuardrails.createdAt, updated_at: workspaceGuardrails.updatedAt,
};

export type GuardrailPatch = Partial<Pick<typeof workspaceGuardrails.$inferInsert,
	"name" | "description" | "enabled" | "privacyEnablePaidMayTrain" | "privacyEnableFreeMayTrain" |
	"privacyEnableFreeMayPublishPrompts" | "privacyEnableInputOutputLogging" | "privacyZdrOnly" |
	"providerRestrictionMode" | "providerRestrictionProviderIds" | "providerRestrictionEnforceAllowed" |
	"modelRestrictionMode" | "allowedApiModelIds" | "promptInjectionEnabled" | "promptInjectionAction" |
	"sensitiveInfoEnabled" | "sensitiveInfoDefaultAction" | "sensitiveInfoRules" |
	"dailyLimitRequests" | "weeklyLimitRequests" | "monthlyLimitRequests" |
	"dailyLimitCostNanos" | "weeklyLimitCostNanos" | "monthlyLimitCostNanos"
>>;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function findGuardrail(workspaceId: string, id: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select(selection).from(workspaceGuardrails).where(and(eq(workspaceGuardrails.workspaceId, workspaceId), eq(workspaceGuardrails.id, id))).limit(1);
		return row ?? null;
	});
}

export async function listGuardrails(workspaceId: string, limit: number, offset: number) {
	return withDatabase((db) => db.select(selection).from(workspaceGuardrails).where(eq(workspaceGuardrails.workspaceId, workspaceId)).orderBy(desc(workspaceGuardrails.createdAt)).limit(limit).offset(offset));
}

export async function createGuardrail(workspaceId: string, name: string, patch: GuardrailPatch) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(workspaceGuardrails).values({ workspaceId, enabled: true, ...patch, name }).returning(selection);
		if (!row) throw new Error("Failed to create guardrail");
		return row;
	});
}

export async function updateGuardrail(workspaceId: string, id: string, patch: GuardrailPatch) {
	return withDatabase(async (db) => {
		const [row] = await db.update(workspaceGuardrails).set({ ...patch, updatedAt: new Date().toISOString() })
			.where(and(eq(workspaceGuardrails.workspaceId, workspaceId), eq(workspaceGuardrails.id, id))).returning(selection);
		return row ?? null;
	});
}

export async function deleteGuardrail(workspaceId: string, id: string): Promise<boolean> {
	return withDatabase(async (db) => (await db.delete(workspaceGuardrails)
		.where(and(eq(workspaceGuardrails.workspaceId, workspaceId), eq(workspaceGuardrails.id, id))).returning({ id: workspaceGuardrails.id })).length > 0);
}

export async function listGuardrailKeyIds(guardrailId: string): Promise<string[]> {
	return withDatabase(async (db) => (await db.select({ id: keyGuardrails.keyId }).from(keyGuardrails).where(eq(keyGuardrails.guardrailId, guardrailId))).map(({ id }) => id));
}

export async function validWorkspaceKeyIds(workspaceId: string, ids: string[]): Promise<Set<string>> {
	if (!ids.length) return new Set();
	return withDatabase(async (db) => new Set((await db.select({ id: keys.id }).from(keys).where(and(eq(keys.workspaceId, workspaceId), inArray(keys.id, ids), ne(keys.status, "deleted")))).map(({ id }) => id)));
}

export async function replaceGuardrailKeys(guardrailId: string, ids: string[]): Promise<void> {
	await withDatabase(async (db) => db.transaction(async (tx) => {
		await tx.delete(keyGuardrails).where(eq(keyGuardrails.guardrailId, guardrailId));
		if (ids.length) await tx.insert(keyGuardrails).values(ids.map((keyId) => ({ keyId, guardrailId })));
	}));
}

export async function addGuardrailKeys(guardrailId: string, ids: string[]): Promise<void> {
	if (!ids.length) return;
	await withDatabase(async (db) => { await db.insert(keyGuardrails).values(ids.map((keyId) => ({ keyId, guardrailId }))).onConflictDoNothing({ target: [keyGuardrails.keyId, keyGuardrails.guardrailId] }); });
}

export async function removeGuardrailKeys(guardrailId: string, ids: string[]): Promise<number> {
	if (!ids.length) return 0;
	return withDatabase(async (db) => (await db.delete(keyGuardrails).where(and(eq(keyGuardrails.guardrailId, guardrailId), inArray(keyGuardrails.keyId, ids))).returning({ id: keyGuardrails.keyId })).length);
}

export async function validWorkspaceMemberIds(workspaceId: string, ids: string[]): Promise<Set<string>> {
	if (!ids.length) return new Set();
	return withDatabase(async (db) => new Set((await db.select({ id: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.userId, ids)))).map(({ id }) => id)));
}

export async function addGuardrailMembers(workspaceId: string, guardrailId: string, ids: string[]): Promise<void> {
	if (!ids.length) return;
	await withDatabase(async (db) => { await db.insert(workspaceMemberGuardrails).values(ids.map((userId) => ({ workspaceId, userId, guardrailId }))).onConflictDoNothing({ target: [workspaceMemberGuardrails.workspaceId, workspaceMemberGuardrails.userId, workspaceMemberGuardrails.guardrailId] }); });
}

export async function removeGuardrailMembers(workspaceId: string, guardrailId: string, ids: string[]): Promise<number> {
	if (!ids.length) return 0;
	return withDatabase(async (db) => (await db.delete(workspaceMemberGuardrails).where(and(eq(workspaceMemberGuardrails.workspaceId, workspaceId), eq(workspaceMemberGuardrails.guardrailId, guardrailId), inArray(workspaceMemberGuardrails.userId, ids))).returning({ id: workspaceMemberGuardrails.userId })).length);
}
