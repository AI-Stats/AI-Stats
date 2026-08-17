import {
	accountGuardrailSettings,
	gatewayDynamicRouteKeys,
	gatewayDynamicRoutes,
	keyGuardrails,
	keys,
	workspaceGuardrails,
	workspaceMemberGuardrails,
	workspaceSettings,
} from "@phaseo/db/schema";
import { and, eq, inArray } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function loadWorkspacePolicyBase(workspaceId: string, keyId: string) {
	return withDatabase(async (db) => {
		const [settings, key, keyGuardrailRows, routeLink] = await Promise.all([
			db.select({
				provider_restriction_mode: workspaceSettings.providerRestrictionMode,
				provider_restriction_provider_ids: workspaceSettings.providerRestrictionProviderIds,
				provider_restriction_enforce_allowed: workspaceSettings.providerRestrictionEnforceAllowed,
				model_restriction_mode: workspaceSettings.modelRestrictionMode,
				model_restriction_model_ids: workspaceSettings.modelRestrictionModelIds,
			}).from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).limit(1),
			db.select({ created_by: keys.createdBy, oauth_user_id: keys.oauthUserId, name: keys.name })
				.from(keys).where(and(eq(keys.id, keyId), eq(keys.workspaceId, workspaceId))).limit(1),
			db.select({ guardrail_id: keyGuardrails.guardrailId }).from(keyGuardrails).where(eq(keyGuardrails.keyId, keyId)),
			db.select({ route_id: gatewayDynamicRouteKeys.routeId }).from(gatewayDynamicRouteKeys)
				.where(eq(gatewayDynamicRouteKeys.keyId, keyId)).limit(1),
		]);
		return { settings: settings[0] ?? null, key: key[0] ?? null, keyGuardrails: keyGuardrailRows, routeLink: routeLink[0] ?? null };
	});
}

export async function loadPrincipalWorkspacePolicy(workspaceId: string, userId: string, includeAccountSettings: boolean) {
	return withDatabase(async (db) => {
		const [memberGuardrails, accountSettings] = await Promise.all([
			db.select({ guardrail_id: workspaceMemberGuardrails.guardrailId }).from(workspaceMemberGuardrails).where(and(
				eq(workspaceMemberGuardrails.workspaceId, workspaceId), eq(workspaceMemberGuardrails.userId, userId),
			)),
			includeAccountSettings ? db.select({
				privacy_enable_paid_may_train: accountGuardrailSettings.privacyEnablePaidMayTrain,
				privacy_enable_free_may_train: accountGuardrailSettings.privacyEnableFreeMayTrain,
				privacy_enable_input_output_logging: accountGuardrailSettings.privacyEnableInputOutputLogging,
				privacy_zdr_only: accountGuardrailSettings.privacyZdrOnly,
				provider_restriction_mode: accountGuardrailSettings.providerRestrictionMode,
				provider_restriction_provider_ids: accountGuardrailSettings.providerRestrictionProviderIds,
				model_restriction_mode: accountGuardrailSettings.modelRestrictionMode,
				model_restriction_model_ids: accountGuardrailSettings.modelRestrictionModelIds,
			}).from(accountGuardrailSettings).where(eq(accountGuardrailSettings.userId, userId)).limit(1) : Promise.resolve([]),
		]);
		return { memberGuardrails, accountSettings: accountSettings[0] ?? null };
	});
}

export async function loadEnabledWorkspaceGuardrails(workspaceId: string, ids: string[]) {
	if (ids.length === 0) return [];
	return withDatabase((db) => db.select({
		id: workspaceGuardrails.id,
		privacy_enable_paid_may_train: workspaceGuardrails.privacyEnablePaidMayTrain,
		privacy_enable_free_may_train: workspaceGuardrails.privacyEnableFreeMayTrain,
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
	}).from(workspaceGuardrails).where(and(
		eq(workspaceGuardrails.workspaceId, workspaceId), eq(workspaceGuardrails.enabled, true), inArray(workspaceGuardrails.id, ids),
	)));
}

export async function loadActiveDynamicRoute(workspaceId: string, routeId: string) {
	return withDatabase(async (db) => (await db.select({
		id: gatewayDynamicRoutes.id,
		name: gatewayDynamicRoutes.name,
		version: gatewayDynamicRoutes.version,
		deployed_version: gatewayDynamicRoutes.deployedVersion,
		config: gatewayDynamicRoutes.config,
		status: gatewayDynamicRoutes.status,
	}).from(gatewayDynamicRoutes).where(and(
		eq(gatewayDynamicRoutes.id, routeId), eq(gatewayDynamicRoutes.workspaceId, workspaceId),
	)).limit(1))[0] ?? null);
}
