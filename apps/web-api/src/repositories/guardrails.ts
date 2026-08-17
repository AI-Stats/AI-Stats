import { accountGuardrailSettings, keyGuardrails, keys, v2Labs, v2Models, v2ModelProviderRoutes, v2Providers, v2RouteCapabilities, users, workspaceGuardrails, workspaceMemberGuardrails, workspaceMembers, workspaceSettings, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, inArray, ne } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listActiveWorkspaceKeyIds(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try { return (await db.select({ id: keys.id }).from(keys).where(and(eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted")))).map((row) => String(row.id)); }
	finally { await client.end({ timeout: 1 }); }
}

export async function getEffectiveGuardrailPolicy(env: Env, input: { workspaceId: string; userId: string }) {
	const { db, client } = createDatabase(env);
	try {
		const [workspace] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, input.workspaceId)).limit(1);
		const [account] = await db.select().from(accountGuardrailSettings).where(eq(accountGuardrailSettings.userId, input.userId)).limit(1);
		const assignments = await db.select({ id: workspaceMemberGuardrails.guardrailId }).from(workspaceMemberGuardrails).where(and(eq(workspaceMemberGuardrails.workspaceId, input.workspaceId), eq(workspaceMemberGuardrails.userId, input.userId)));
		const ids = assignments.map((row) => row.id);
		const guardrails = ids.length ? await db.select().from(workspaceGuardrails).where(and(eq(workspaceGuardrails.workspaceId, input.workspaceId), eq(workspaceGuardrails.enabled, true), inArray(workspaceGuardrails.id, ids))) : [];
		return { workspace, account, guardrails };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getRoutingPolicySettings(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env); try {
		const [[workspace], [settings]] = await Promise.all([db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1), db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).limit(1)]);
		return { workspace: workspace ?? null, settings: settings ?? null };
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadPrivacySettings(env: Env, input: { workspaceId: string; userId: string }) {
	const { db, client } = createDatabase(env);
	try {
		const [[workspace], [settings], [account], providers, routes] = await Promise.all([
			db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1),
			db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, input.workspaceId)).limit(1),
			db.select().from(accountGuardrailSettings).where(eq(accountGuardrailSettings.userId, input.userId)).limit(1),
			db.select().from(v2Providers).where(and(eq(v2Providers.routable, true), eq(v2Providers.routingEnabled, true), inArray(v2Providers.status, ["active", "degraded"]))).orderBy(v2Providers.name),
			db.select().from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]))),
		]);
		const modelSlugs = [...new Set(routes.map((route) => route.modelSlug))];
		const models = modelSlugs.length
			? await db.select({ model: v2Models, lab: v2Labs }).from(v2Models)
				.leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug))
				.where(inArray(v2Models.modelSlug, modelSlugs)).orderBy(v2Models.name)
			: [];
		return { workspace: workspace ?? null, settings: settings ?? null, account: account ?? null, providers, routes, models };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getPrivacyPolicies(env: Env, input: { workspaceId: string; userId: string }) {
	const { db, client } = createDatabase(env);
	try {
		const [[workspace], [account]] = await Promise.all([
			db.select({
				privacyEnablePaidMayTrain: workspaceSettings.privacyEnablePaidMayTrain,
				privacyEnableFreeMayTrain: workspaceSettings.privacyEnableFreeMayTrain,
				privacyZdrOnly: workspaceSettings.privacyZdrOnly,
				providerRestrictionMode: workspaceSettings.providerRestrictionMode,
				providerRestrictionProviderIds: workspaceSettings.providerRestrictionProviderIds,
			}).from(workspaceSettings).where(eq(workspaceSettings.workspaceId, input.workspaceId)).limit(1),
			db.select({
				providerRestrictionMode: accountGuardrailSettings.providerRestrictionMode,
				providerRestrictionProviderIds: accountGuardrailSettings.providerRestrictionProviderIds,
			}).from(accountGuardrailSettings).where(eq(accountGuardrailSettings.userId, input.userId)).limit(1),
		]);
		return { workspace: workspace ?? null, account: account ?? null };
	} finally { await client.end({ timeout: 1 }); }
}

export async function saveRoutingPolicySettings(env: Env, workspaceId: string, values: Partial<typeof workspaceSettings.$inferInsert>) {
	const { db, client } = createDatabase(env); try { await db.insert(workspaceSettings).values({ workspaceId, ...values }).onConflictDoUpdate({ target: workspaceSettings.workspaceId, set: values }); } finally { await client.end({ timeout: 1 }); }
}

function guardrailRow(row: typeof workspaceGuardrails.$inferSelect) {
	return { id: row.id, workspace_id: row.workspaceId, enabled: row.enabled, name: row.name, description: row.description, privacy_enable_paid_may_train: row.privacyEnablePaidMayTrain, privacy_enable_free_may_train: row.privacyEnableFreeMayTrain, privacy_enable_free_may_publish_prompts: row.privacyEnableFreeMayPublishPrompts, privacy_enable_input_output_logging: row.privacyEnableInputOutputLogging, privacy_zdr_only: row.privacyZdrOnly, provider_restriction_mode: row.providerRestrictionMode, provider_restriction_provider_ids: row.providerRestrictionProviderIds, provider_restriction_enforce_allowed: row.providerRestrictionEnforceAllowed, model_restriction_mode: row.modelRestrictionMode, allowed_api_model_ids: row.allowedApiModelIds, prompt_injection_enabled: row.promptInjectionEnabled, prompt_injection_action: row.promptInjectionAction, sensitive_info_enabled: row.sensitiveInfoEnabled, sensitive_info_default_action: row.sensitiveInfoDefaultAction, sensitive_info_rules: row.sensitiveInfoRules, daily_limit_requests: row.dailyLimitRequests, weekly_limit_requests: row.weeklyLimitRequests, monthly_limit_requests: row.monthlyLimitRequests, daily_limit_cost_nanos: row.dailyLimitCostNanos, weekly_limit_cost_nanos: row.weeklyLimitCostNanos, monthly_limit_cost_nanos: row.monthlyLimitCostNanos, created_at: row.createdAt, updated_at: row.updatedAt };
}

export async function loadGuardrailReferenceData(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env); try {
		const [workspace] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
		const keyRows = await db.select({ id: keys.id, name: keys.name, prefix: keys.prefix, status: keys.status }).from(keys).where(and(eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted"), ne(keys.name, "__chat_route_managed_key__"))).orderBy(desc(keys.createdAt));
		const memberRows = await db.select({ id: workspaceMembers.userId, role: workspaceMembers.role, name: users.displayName }).from(workspaceMembers).leftJoin(users, eq(users.userId, workspaceMembers.userId)).where(eq(workspaceMembers.workspaceId, workspaceId));
		const providerRows = await db.select().from(v2Providers).where(and(eq(v2Providers.routable, true), eq(v2Providers.routingEnabled, true), inArray(v2Providers.status, ["active", "degraded"]))).orderBy(v2Providers.name);
		const routeRows = await db.select().from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"])));
		const modelSlugs = [...new Set(routeRows.map((row) => row.modelSlug))];
		const models = modelSlugs.length ? await db.select({ model: v2Models, lab: v2Labs }).from(v2Models).leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(inArray(v2Models.modelSlug, modelSlugs)) : [];
		const modelBySlug = new Map(models.map(({model,lab}) => [model.modelSlug,{model,lab}]));
		const routeIds = routeRows.map((row) => row.providerModelId);
		const capabilities = routeIds.length ? await db.select().from(v2RouteCapabilities).where(and(inArray(v2RouteCapabilities.providerModelId, routeIds), inArray(v2RouteCapabilities.capabilityId, ["batch", "files.upload", "files.list", "files.retrieve"]), inArray(v2RouteCapabilities.status, ["active", "degraded"]))) : [];
		const capabilitiesByRoute = new Map<string, Array<{id:string;dataPolicy:Record<string,unknown>|null}>>(); for(const row of capabilities){const metadata=row.metadata&&typeof row.metadata==="object"?row.metadata as Record<string,unknown>:{};const policy=metadata.data_policy&&typeof metadata.data_policy==="object"?metadata.data_policy as Record<string,unknown>:null;capabilitiesByRoute.set(row.providerModelId,[...(capabilitiesByRoute.get(row.providerModelId)??[]),{id:row.capabilityId,dataPolicy:policy}]);}
		const providerById = new Map(providerRows.map((row)=>[row.providerSlug,row])); const routableIds=new Set(routeRows.map((row)=>row.providerSlug));
		return { activeProviderModels: routeRows.map((route)=>{const metadata=modelBySlug.get(route.modelSlug);const provider=providerById.get(route.providerSlug);return {apiModelId:route.modelSlug,internalModelId:route.modelSlug,internalModelName:metadata?.model.name??null,organisationId:metadata?.lab?.labSlug??metadata?.model.labSlug??null,organisationName:metadata?.lab?.name??null,providerId:route.providerSlug,providerPolicy:provider?{zeroDataRetention:provider.zeroDataRetention,dataPolicyTier:provider.dataPolicyTier,dataPolicyConfidence:provider.dataPolicyConfidence}:undefined,capabilities:capabilitiesByRoute.get(route.providerModelId)??[]};}), keys:keyRows, members:memberRows.map((row)=>({id:row.id,name:row.name??"Workspace member",role:row.role})), providers:providerRows.filter((row)=>routableIds.has(row.providerSlug)).map((row)=>({id:row.providerSlug,name:row.name,familyId:row.providerFamilySlug??row.providerSlug,offerLabel:row.offerLabel,offerScope:row.offerScope})), teamName:workspace?.name??null };
	} finally { await client.end({timeout:1}); }
}

export async function loadGuardrailSettings(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env); try {
		const rows=await db.select().from(workspaceGuardrails).where(eq(workspaceGuardrails.workspaceId,workspaceId)).orderBy(desc(workspaceGuardrails.createdAt)); const ids=rows.map((row)=>row.id);
		const keyRows=ids.length?await db.select().from(keyGuardrails).where(inArray(keyGuardrails.guardrailId,ids)):[]; const memberRows=ids.length?await db.select().from(workspaceMemberGuardrails).where(and(eq(workspaceMemberGuardrails.workspaceId,workspaceId),inArray(workspaceMemberGuardrails.guardrailId,ids))):[];
		const keyMap=new Map<string,string[]>();for(const row of keyRows)keyMap.set(row.guardrailId,[...(keyMap.get(row.guardrailId)??[]),row.keyId]); const memberMap=new Map<string,string[]>();for(const row of memberRows)memberMap.set(row.guardrailId,[...(memberMap.get(row.guardrailId)??[]),row.userId]);
		return {guardrails:rows.map(guardrailRow),guardrailKeyIdsByGuardrailId:Object.fromEntries(keyMap),guardrailMemberIdsByGuardrailId:Object.fromEntries(memberMap)};
	} finally { await client.end({timeout:1}); }
}

export async function loadGuardrailEditorData(env: Env,input:{workspaceId:string;userId:string;guardrailId?:string}){
	const {db,client}=createDatabase(env);try{const [guardrail]=input.guardrailId?await db.select().from(workspaceGuardrails).where(and(eq(workspaceGuardrails.workspaceId,input.workspaceId),eq(workspaceGuardrails.id,input.guardrailId))).limit(1):[];const [account]=await db.select().from(accountGuardrailSettings).where(eq(accountGuardrailSettings.userId,input.userId)).limit(1);const keyRows=guardrail?await db.select({id:keyGuardrails.keyId}).from(keyGuardrails).where(eq(keyGuardrails.guardrailId,guardrail.id)):[];const memberRows=guardrail?await db.select({id:workspaceMemberGuardrails.userId}).from(workspaceMemberGuardrails).where(and(eq(workspaceMemberGuardrails.workspaceId,input.workspaceId),eq(workspaceMemberGuardrails.guardrailId,guardrail.id))):[];return{guardrail:guardrail?guardrailRow(guardrail):null,account:account??null,initialKeyIds:keyRows.map((row)=>row.id),initialMemberIds:memberRows.map((row)=>row.id)};}finally{await client.end({timeout:1});}
}

export async function validateRoutableModels(env: Env, modelIds: string[]) {
	if (!modelIds.length) return true;
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.selectDistinct({ modelId: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(and(
			inArray(v2ModelProviderRoutes.modelSlug, modelIds), eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]),
		));
		const valid = new Set(rows.map((row) => String(row.modelId)));
		return modelIds.every((id) => valid.has(id));
	} finally { await client.end({ timeout: 1 }); }
}

export async function upsertGlobalGuardrail(env: Env, workspaceId: string, values: Partial<typeof workspaceSettings.$inferInsert>) {
	const { db, client } = createDatabase(env);
	try { await db.insert(workspaceSettings).values({ workspaceId, ...values }).onConflictDoUpdate({ target: workspaceSettings.workspaceId, set: values }); }
	finally { await client.end({ timeout: 1 }); }
}

export async function createWorkspaceGuardrail(env: Env, values: typeof workspaceGuardrails.$inferInsert) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.insert(workspaceGuardrails).values(values).returning({ id: workspaceGuardrails.id }); return row ?? null; }
	finally { await client.end({ timeout: 1 }); }
}

export async function updateWorkspaceGuardrail(env: Env, id: string, workspaceId: string, values: Partial<typeof workspaceGuardrails.$inferInsert>) {
	const { db, client } = createDatabase(env);
	try { await db.update(workspaceGuardrails).set(values).where(and(eq(workspaceGuardrails.id, id), eq(workspaceGuardrails.workspaceId, workspaceId))); }
	finally { await client.end({ timeout: 1 }); }
}

export async function deleteWorkspaceGuardrail(env: Env, id: string, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try { await db.delete(workspaceGuardrails).where(and(eq(workspaceGuardrails.id, id), eq(workspaceGuardrails.workspaceId, workspaceId))); }
	finally { await client.end({ timeout: 1 }); }
}

export async function replaceGuardrailKeys(env: Env, input: { guardrailId: string; workspaceId: string; keyIds: string[] }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const [guardrail] = await tx.select({ id: workspaceGuardrails.id }).from(workspaceGuardrails).where(and(eq(workspaceGuardrails.id, input.guardrailId), eq(workspaceGuardrails.workspaceId, input.workspaceId))).limit(1);
		if (!guardrail) return "guardrail_not_found" as const;
		if (input.keyIds.length) {
			const valid = await tx.select({ id: keys.id }).from(keys).where(and(inArray(keys.id, input.keyIds), eq(keys.workspaceId, input.workspaceId), ne(keys.status, "deleted")));
			if (valid.length !== input.keyIds.length) return "invalid_keys" as const;
		}
		await tx.delete(keyGuardrails).where(eq(keyGuardrails.guardrailId, input.guardrailId));
		if (input.keyIds.length) await tx.insert(keyGuardrails).values(input.keyIds.map((keyId) => ({ keyId, guardrailId: input.guardrailId })));
		return "ok" as const;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function replaceGuardrailMembers(env: Env, input: { guardrailId: string; workspaceId: string; userIds: string[] }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const [guardrail] = await tx.select({ id: workspaceGuardrails.id }).from(workspaceGuardrails).where(and(eq(workspaceGuardrails.id, input.guardrailId), eq(workspaceGuardrails.workspaceId, input.workspaceId))).limit(1);
		if (!guardrail) return "guardrail_not_found" as const;
		if (input.userIds.length) {
			const valid = await tx.select({ id: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, input.workspaceId), inArray(workspaceMembers.userId, input.userIds)));
			if (valid.length !== input.userIds.length) return "invalid_members" as const;
		}
		await tx.delete(workspaceMemberGuardrails).where(and(eq(workspaceMemberGuardrails.workspaceId, input.workspaceId), eq(workspaceMemberGuardrails.guardrailId, input.guardrailId)));
		if (input.userIds.length) await tx.insert(workspaceMemberGuardrails).values(input.userIds.map((userId) => ({ workspaceId: input.workspaceId, userId, guardrailId: input.guardrailId })));
		return "ok" as const;
	}); } finally { await client.end({ timeout: 1 }); }
}
