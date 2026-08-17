import { byokKeys, keys, presets, v2ModelAliases, v2ModelProviderRoutes, v2Models, v2Providers, v2RouteCapabilities, wallets, workspaceSettings, workspaces } from "@phaseo/db/schema";
import { and, eq, inArray, or, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function findWallet(workspaceId: string) {
	return withDatabase(async (db) => (await db.select({ balance_nanos: wallets.balanceNanos, reserved_nanos: wallets.reservedNanos }).from(wallets).where(eq(wallets.workspaceId, workspaceId)).limit(1))[0] ?? null);
}

export async function listByokKeys(args: { workspaceId: string; keyIds?: string[]; providerIds: string[]; metadataOnly?: boolean }) {
	return withDatabase(async (db) => {
		const conditions = [eq(byokKeys.workspaceId, args.workspaceId), eq(byokKeys.enabled, true), inArray(byokKeys.providerId, args.providerIds)];
		if (args.keyIds?.length) conditions.push(inArray(byokKeys.id, args.keyIds));
		if (args.metadataOnly) return db.select({ id: byokKeys.id, provider_id: byokKeys.providerId, fingerprint_sha256: byokKeys.fingerprintSha256, key_version: byokKeys.keyVersion, always_use: byokKeys.alwaysUse }).from(byokKeys).where(and(...conditions));
		return db.select({
			id: byokKeys.id, workspace_id: byokKeys.workspaceId, provider_id: byokKeys.providerId, name: byokKeys.name,
			fingerprint_sha256: byokKeys.fingerprintSha256, key_version: byokKeys.keyVersion, always_use: byokKeys.alwaysUse,
			routing_mode: byokKeys.routingMode, sort_order: byokKeys.sortOrder, allowed_model_slugs: byokKeys.allowedModelSlugs,
			allowed_api_key_ids: byokKeys.allowedApiKeyIds,
			enc_value: byokKeys.encValue, enc_iv: byokKeys.encIv, enc_tag: byokKeys.encTag,
		}).from(byokKeys).where(and(...conditions));
	});
}

export async function findEnabledByokKey(args: { id: string; workspaceId: string; providerId: string }) {
	return withDatabase(async (db) => (await db.select({
		id: byokKeys.id,
		key_version: byokKeys.keyVersion,
		enc_iv: byokKeys.encIv,
		enc_value: byokKeys.encValue,
		enc_tag: byokKeys.encTag,
	}).from(byokKeys).where(and(
		eq(byokKeys.id, args.id),
		eq(byokKeys.workspaceId, args.workspaceId),
		eq(byokKeys.providerId, args.providerId),
		eq(byokKeys.enabled, true),
	)).limit(1))[0] ?? null);
}

export async function touchByokKeyLastUsed(args: { id: string; workspaceId: string; usedAt?: string }): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(byokKeys).set({ lastUsedAt: args.usedAt ?? new Date().toISOString() }).where(and(
			eq(byokKeys.id, args.id),
			eq(byokKeys.workspaceId, args.workspaceId),
		));
	});
}

export async function listActiveProviderSlugsForCapability(args: { modelSlug: string; capabilityId: string }) {
	return withDatabase((db) => db.selectDistinct({ provider_id: v2ModelProviderRoutes.providerSlug })
		.from(v2ModelProviderRoutes)
		.innerJoin(
			v2RouteCapabilities,
			eq(v2RouteCapabilities.providerModelId, v2ModelProviderRoutes.providerModelId),
		)
		.where(and(
			eq(v2ModelProviderRoutes.modelSlug, args.modelSlug),
			eq(v2ModelProviderRoutes.routingEnabled, true),
			inArray(v2ModelProviderRoutes.status, ["active", "degraded"]),
			eq(v2RouteCapabilities.capabilityId, args.capabilityId),
			eq(v2RouteCapabilities.status, "active"),
			sql`(${v2ModelProviderRoutes.effectiveFrom} is null or ${v2ModelProviderRoutes.effectiveFrom} <= now())`,
			sql`(${v2ModelProviderRoutes.effectiveTo} is null or ${v2ModelProviderRoutes.effectiveTo} > now())`,
			sql`(${v2RouteCapabilities.effectiveFrom} is null or ${v2RouteCapabilities.effectiveFrom} <= now())`,
			sql`(${v2RouteCapabilities.effectiveTo} is null or ${v2RouteCapabilities.effectiveTo} > now())`,
		)));
}

const routeSelection = {
	provider_api_model_id: v2ModelProviderRoutes.providerModelId, provider_id: v2ModelProviderRoutes.providerSlug,
	provider_model_slug: v2ModelProviderRoutes.providerModelSlug, api_model_id: v2ModelProviderRoutes.modelSlug,
	model_id: v2ModelProviderRoutes.modelSlug, is_active_gateway: v2ModelProviderRoutes.routingEnabled,
	routing_status: v2ModelProviderRoutes.status, provider_availability_status: v2ModelProviderRoutes.providerAvailabilityStatus,
	phaseo_status: v2ModelProviderRoutes.phaseoStatus, access_scope: v2ModelProviderRoutes.accessScope,
	effective_from: v2ModelProviderRoutes.effectiveFrom, effective_to: v2ModelProviderRoutes.effectiveTo,
	input_modalities: v2ModelProviderRoutes.inputModalities, output_modalities: v2ModelProviderRoutes.outputModalities,
	metadata: v2ModelProviderRoutes.metadata,
};

export async function listRoutes(args: { modelIds?: string[]; providerIds?: string[]; providerId?: string; providerModelSlug?: string; freeOnly?: boolean; testingOnly?: boolean }) {
	return withDatabase((db) => {
		const conditions = [inArray(v2ModelProviderRoutes.status, ["active", "degraded"] as const)];
		if (!args.testingOnly) conditions.push(eq(v2ModelProviderRoutes.routingEnabled, true));
		if (args.modelIds?.length) conditions.push(inArray(v2ModelProviderRoutes.modelSlug, args.modelIds));
		if (args.providerIds?.length) conditions.push(inArray(v2ModelProviderRoutes.providerSlug, args.providerIds));
		if (args.providerId) conditions.push(eq(v2ModelProviderRoutes.providerSlug, args.providerId));
		if (args.providerModelSlug) conditions.push(eq(v2ModelProviderRoutes.providerModelSlug, args.providerModelSlug));
		if (args.freeOnly) conditions.push(sql`${v2ModelProviderRoutes.modelSlug} like '%:free'`);
		if (args.testingOnly) conditions.push(and(eq(v2ModelProviderRoutes.accessScope, "internal"), inArray(v2ModelProviderRoutes.phaseoStatus, ["testing", "enabled"]), inArray(v2ModelProviderRoutes.providerAvailabilityStatus, ["available", "preview", "limited_access"]))!);
		return db.select(routeSelection).from(v2ModelProviderRoutes).where(and(...conditions));
	});
}

export async function listCapabilities(args: { providerModelIds: string[]; capabilityIds: string[]; statuses: readonly string[] }) {
	return withDatabase((db) => db.select({ provider_api_model_id: v2RouteCapabilities.providerModelId, params: v2RouteCapabilities.params, max_input_tokens: v2RouteCapabilities.maxInputTokens, max_output_tokens: v2RouteCapabilities.maxOutputTokens, status: v2RouteCapabilities.status, updated_at: v2RouteCapabilities.updatedAt, created_at: v2RouteCapabilities.createdAt }).from(v2RouteCapabilities).where(and(inArray(v2RouteCapabilities.providerModelId, args.providerModelIds), inArray(v2RouteCapabilities.capabilityId, args.capabilityIds), inArray(v2RouteCapabilities.status, [...args.statuses]))));
}

export async function listModels(modelIds: string[]) {
	return withDatabase((db) => db.select({ model_id: v2Models.modelSlug, hidden: v2Models.hidden, status: v2Models.status, deprecation_date: v2Models.deprecatedAt, retirement_date: v2Models.retiredAt }).from(v2Models).where(inArray(v2Models.modelSlug, modelIds)));
}

const providerSelection = {
	provider_slug: v2Providers.providerSlug, api_provider_id: v2Providers.providerSlug, status: v2Providers.status,
	routing_enabled: v2Providers.routingEnabled, routing_status: v2Providers.routingEnabled, provider_family_slug: v2Providers.providerFamilySlug,
	offer_scope: v2Providers.offerScope, offer_label: v2Providers.offerLabel, residency_mode: v2Providers.residencyMode,
	default_execution_regions: v2Providers.defaultExecutionRegions, default_data_regions: v2Providers.defaultDataRegions,
	zero_data_retention: v2Providers.zeroDataRetention, prompt_training_policy: v2Providers.promptTrainingPolicy,
	data_policy_tier: v2Providers.dataPolicyTier, data_policy_confidence: v2Providers.dataPolicyConfidence,
	data_policy_contract_mode: v2Providers.dataPolicyContractMode, data_policy_variant: v2Providers.dataPolicyVariant,
	stream_cancellation_support: v2Providers.streamCancellationSupport,
	stream_cancellation_stops_provider_billing: v2Providers.streamCancellationStopsProviderBilling,
	stream_cancellation_usage_recovery: v2Providers.streamCancellationUsageRecovery,
	stream_cancellation_evidence_kind: v2Providers.streamCancellationEvidenceKind,
	stream_cancellation_source_url: v2Providers.streamCancellationSourceUrl, metadata: v2Providers.metadata,
};

export async function listProviders(providerIds: string[]) {
	if (!providerIds.length) return [];
	return withDatabase((db) => db.select(providerSelection).from(v2Providers).where(inArray(v2Providers.providerSlug, providerIds)));
}

export async function loadWorkspaceEnrichment(workspaceId: string, providerIds: string[]) {
	return withDatabase(async (db) => {
		const [settings, workspace, providers] = await Promise.all([
			db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).limit(1),
			db.select({ billing_mode: workspaces.billingMode }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
			providerIds.length ? db.select(providerSelection).from(v2Providers).where(inArray(v2Providers.providerSlug, providerIds)) : Promise.resolve([]),
		]);
		const raw = settings[0];
		return {
			settings: raw ? Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])) : null,
			workspace: workspace[0] ?? null,
			providers,
		};
	});
}

function number(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export function presetAccessPredicate(apiKeyCreatorId: string) {
	return or(
		inArray(presets.visibility, ["public", "team"]),
		eq(presets.createdBy, apiKeyCreatorId),
	);
}

export async function fetchRequestContext(args: { workspaceId: string; model: string; endpoint: string; apiKeyId: string }) {
	return withDatabase(async (db) => {
		const [key] = await db.select().from(keys).where(eq(keys.id, args.apiKeyId)).limit(1);
		if (!key) throw new Error("api_key_not_found");
		if (key.workspaceId !== args.workspaceId) throw new Error("api_key_wrong_team");
		if (key.status !== "active") throw new Error("api_key_inactive");

		let baseModel = args.model;
		let preset: Record<string, unknown> | null = null;
		if (baseModel.startsWith("@")) {
			const slug = baseModel.slice(1);
			const [row] = await db.select({ id: presets.id, name: presets.name, slug: presets.slug, description: presets.description, config: presets.config, visibility: presets.visibility }).from(presets).where(and(eq(presets.workspaceId, args.workspaceId), sql`coalesce(nullif(${presets.slug},''),regexp_replace(${presets.name},'^@',''))=${slug}`, sql`${presets.archivedAt} is null`, presetAccessPredicate(key.createdBy))).limit(1);
			if (!row) throw new Error("preset_not_found");
			preset = row;
			const config = row.config && typeof row.config === "object" && !Array.isArray(row.config) ? row.config as Record<string, any> : {};
			baseModel = String(config.defaultModel ?? config.default_model ?? config.model ?? config.models?.[0] ?? config.allowedModels?.[0] ?? config.allowed_models?.[0] ?? "");
			if (!baseModel) throw new Error("preset_no_model");
		}

		let resolvedModel = baseModel;
		const [alias] = await db.select({ modelSlug: v2ModelAliases.modelSlug }).from(v2ModelAliases).where(and(
			eq(v2ModelAliases.aliasSlug, baseModel),
			eq(v2ModelAliases.enabled, true),
			sql`(${v2ModelAliases.effectiveFrom} is null or ${v2ModelAliases.effectiveFrom} <= now())`,
			sql`(${v2ModelAliases.effectiveTo} is null or ${v2ModelAliases.effectiveTo} > now())`,
		)).limit(1);
		if (alias?.modelSlug) resolvedModel = alias.modelSlug;
		else if (baseModel.includes("/")) {
			const provider = baseModel.slice(0, baseModel.indexOf("/")); const providerModel = baseModel.slice(baseModel.indexOf("/") + 1);
			const [route] = await db.select({ model: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.providerSlug, provider), eq(v2ModelProviderRoutes.providerModelSlug, providerModel), eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]), sql`(${v2ModelProviderRoutes.effectiveFrom} is null or ${v2ModelProviderRoutes.effectiveFrom}<=now())`, sql`(${v2ModelProviderRoutes.effectiveTo} is null or ${v2ModelProviderRoutes.effectiveTo}>now())`)).orderBy(sql`${v2ModelProviderRoutes.effectiveFrom} desc nulls last`).limit(1);
			if (route?.model) resolvedModel = route.model;
		}

		const [wallet] = await db.select().from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1);
		const [workspace] = await db.select({ createdAt: workspaces.createdAt, tier: workspaces.tier }).from(workspaces).where(eq(workspaces.id, args.workspaceId)).limit(1);
		const [usage] = await db.execute<Record<string, unknown>>(sql`select
			count(*) filter(where key_id=${args.apiKeyId}::uuid and created_at>=date_trunc('day',now()) and success)::bigint key_day_reqs,
			count(*) filter(where key_id=${args.apiKeyId}::uuid and created_at>=date_trunc('week',now()) and success)::bigint key_week_reqs,
			count(*) filter(where key_id=${args.apiKeyId}::uuid and created_at>=date_trunc('month',now()) and success)::bigint key_month_reqs,
			coalesce(sum(cost_nanos) filter(where key_id=${args.apiKeyId}::uuid and created_at>=date_trunc('day',now()) and success),0)::bigint key_day_cost,
			coalesce(sum(cost_nanos) filter(where key_id=${args.apiKeyId}::uuid and created_at>=date_trunc('week',now()) and success),0)::bigint key_week_cost,
			coalesce(sum(cost_nanos) filter(where key_id=${args.apiKeyId}::uuid and created_at>=date_trunc('month',now()) and success),0)::bigint key_month_cost,
			count(*) filter(where key_id=${args.apiKeyId}::uuid and success)::bigint key_total_reqs,
			coalesce(sum(cost_nanos) filter(where key_id=${args.apiKeyId}::uuid and success),0)::bigint key_total_cost,
			count(*) filter(where success)::bigint team_total_reqs,coalesce(sum(cost_nanos) filter(where success),0)::bigint team_total_cost,
			coalesce(sum(cost_nanos) filter(where success and created_at>=now()-interval '24 hours'),0)::bigint team_cost_24h,
			coalesce(sum(cost_nanos) filter(where success and created_at>=now()-interval '7 days'),0)::bigint team_cost_7d,
			coalesce(sum(cost_nanos) filter(where success and created_at>=now()-interval '30 days'),0)::bigint team_cost_30d,
			count(*) filter(where success and created_at>=now()-interval '1 hour')::bigint team_reqs_1h,
			count(*) filter(where success and created_at>=now()-interval '24 hours')::bigint team_reqs_24h
			from observability.gateway_requests where workspace_id=${args.workspaceId}::uuid`);

		const routeRows = await db.select(routeSelection).from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.modelSlug, resolvedModel), eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]), sql`(${v2ModelProviderRoutes.effectiveFrom} is null or ${v2ModelProviderRoutes.effectiveFrom}<=now())`, sql`(${v2ModelProviderRoutes.effectiveTo} is null or ${v2ModelProviderRoutes.effectiveTo}>now())`));
		const routeIds = routeRows.map((row) => row.provider_api_model_id);
		const capabilityRows = routeIds.length ? await db.select({ providerModelId: v2RouteCapabilities.providerModelId, status: v2RouteCapabilities.status, params: v2RouteCapabilities.params, maxInputTokens: v2RouteCapabilities.maxInputTokens, maxOutputTokens: v2RouteCapabilities.maxOutputTokens }).from(v2RouteCapabilities).where(and(inArray(v2RouteCapabilities.providerModelId, routeIds), eq(v2RouteCapabilities.capabilityId, args.endpoint), inArray(v2RouteCapabilities.status, ["active", "degraded"]))) : [];
		const capabilityByRoute = new Map(capabilityRows.map((row) => [row.providerModelId, row]));
		const providerIds = [...new Set(routeRows.map((row) => row.provider_id))];
		const providerRows = providerIds.length ? await db.select(providerSelection).from(v2Providers).where(inArray(v2Providers.providerSlug, providerIds)) : [];
		const providerById = new Map(providerRows.map((row) => [row.provider_slug, row]));
		const byokRows = providerIds.length ? await db.select({ id: byokKeys.id, provider_id: byokKeys.providerId, fingerprint_sha256: byokKeys.fingerprintSha256, key_version: byokKeys.keyVersion, always_use: byokKeys.alwaysUse, routing_mode: byokKeys.routingMode, sort_order: byokKeys.sortOrder }).from(byokKeys).where(and(eq(byokKeys.workspaceId, args.workspaceId), eq(byokKeys.enabled, true), inArray(byokKeys.providerId, providerIds))) : [];
		const byokByProvider = new Map<string, typeof byokRows>(); for (const row of byokRows) byokByProvider.set(row.provider_id, [...(byokByProvider.get(row.provider_id) ?? []), row]);
		const providers = routeRows.flatMap((route) => { const cap = capabilityByRoute.get(route.provider_api_model_id); if (!cap) return []; const provider = providerById.get(route.provider_id); return [{ provider_id: route.provider_id, api_model_id: route.api_model_id, pricing_key: route.provider_id, provider_model_slug: route.provider_model_slug, provider_status: provider?.status ?? null, provider_routing_status: provider?.routing_enabled ? "active" : "disabled", model_status: route.routing_status, capability_status: cap.status, input_modalities: route.input_modalities, output_modalities: route.output_modalities, prompt_training_policy: provider?.prompt_training_policy ?? "unknown", data_policy_tier: provider?.data_policy_tier ?? "unknown", data_policy_confidence: provider?.data_policy_confidence ?? "unknown", data_policy_contract_mode: provider?.data_policy_contract_mode ?? "none", data_policy_variant: provider?.data_policy_variant ?? "standard", supports_endpoint: true, base_weight: 1, byok_meta: byokByProvider.get(route.provider_id) ?? [], capability_params: cap.params ?? {}, max_input_tokens: cap.maxInputTokens, max_output_tokens: cap.maxOutputTokens }]; });

		const dayReqs=number(usage?.key_day_reqs),weekReqs=number(usage?.key_week_reqs),monthReqs=number(usage?.key_month_reqs),dayCost=number(usage?.key_day_cost),weekCost=number(usage?.key_week_cost),monthCost=number(usage?.key_month_cost);
		const checks: Array<[boolean,string,string,string,number,number,string]> = [[Boolean(key.softBlocked),"key_limit_soft_blocked","", "soft_blocked",0,0,""],[number(key.dailyLimitRequests)>0&&dayReqs>=number(key.dailyLimitRequests),"daily_request_limit_reached","daily","requests",dayReqs,number(key.dailyLimitRequests),"1 day"],[number(key.weeklyLimitRequests)>0&&weekReqs>=number(key.weeklyLimitRequests),"weekly_request_limit_reached","weekly","requests",weekReqs,number(key.weeklyLimitRequests),"1 week"],[number(key.monthlyLimitRequests)>0&&monthReqs>=number(key.monthlyLimitRequests),"monthly_request_limit_reached","monthly","requests",monthReqs,number(key.monthlyLimitRequests),"1 month"],[number(key.dailyLimitCostNanos)>0&&dayCost>=number(key.dailyLimitCostNanos),"daily_cost_limit_reached","daily","cost",dayCost,number(key.dailyLimitCostNanos),"1 day"],[number(key.weeklyLimitCostNanos)>0&&weekCost>=number(key.weeklyLimitCostNanos),"weekly_cost_limit_reached","weekly","cost",weekCost,number(key.weeklyLimitCostNanos),"1 week"],[number(key.monthlyLimitCostNanos)>0&&monthCost>=number(key.monthlyLimitCostNanos),"monthly_cost_limit_reached","monthly","cost",monthCost,number(key.monthlyLimitCostNanos),"1 month"]];
		const failed=checks.find(([condition])=>condition); const available=Math.max(0,number(wallet?.balanceNanos)-number(wallet?.reservedNanos)); const now=new Date();
		const bucket=(start:string,requests:number,requestsLimit:unknown,cost:number,costLimit:unknown)=>({window_start:start,requests_used:requests,requests_limit:number(requestsLimit),cost_used_nanos:cost,cost_limit_nanos:number(costLimit)});
		const dayStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString(); const monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString(); const week=new Date(dayStart); week.setUTCDate(week.getUTCDate()-((week.getUTCDay()+6)%7));
		return { workspace_id: args.workspaceId, resolved_model: resolvedModel, preset, key_ok:{ok:true}, key_limit_ok:{ok:!failed,reason:failed?.[1]??null,limit_window:failed?.[2]||null,limit_metric:failed?.[3]||null,current_value:failed?.[4]??null,limit_value:failed?.[5]??null,reset_at:null,now:now.toISOString(),buckets:{daily:bucket(dayStart,dayReqs,key.dailyLimitRequests,dayCost,key.dailyLimitCostNanos),weekly:bucket(week.toISOString(),weekReqs,key.weeklyLimitRequests,weekCost,key.weeklyLimitCostNanos),monthly:bucket(monthStart,monthReqs,key.monthlyLimitRequests,monthCost,key.monthlyLimitCostNanos)}}, credit_ok:{ok:Boolean(wallet)&&available>=1_000_000_000,reason:!wallet?"wallet_missing":available>=1_000_000_000?null:"insufficient_funds",balance_nanos:available}, providers, pricing:{}, team_enrichment: workspace?{tier:workspace.tier??"basic",created_at:workspace.createdAt,account_age_days:(Date.now()-Date.parse(workspace.createdAt))/86400000,balance_nanos:available,balance_usd:available/1e9,balance_is_low:available<1e9,total_requests:number(usage?.team_total_reqs),total_spend_nanos:number(usage?.team_total_cost),total_spend_usd:number(usage?.team_total_cost)/1e9,spend_24h_nanos:number(usage?.team_cost_24h),spend_24h_usd:number(usage?.team_cost_24h)/1e9,spend_7d_nanos:number(usage?.team_cost_7d),spend_7d_usd:number(usage?.team_cost_7d)/1e9,spend_30d_nanos:number(usage?.team_cost_30d),spend_30d_usd:number(usage?.team_cost_30d)/1e9,requests_1h:number(usage?.team_reqs_1h),requests_24h:number(usage?.team_reqs_24h)}:null, key_enrichment:{name:key.name,created_at:key.createdAt,key_age_days:(Date.now()-Date.parse(key.createdAt))/86400000,total_requests:number(usage?.key_total_reqs),total_spend_nanos:number(usage?.key_total_cost),total_spend_usd:number(usage?.key_total_cost)/1e9,requests_today:dayReqs,spend_today_nanos:dayCost,spend_today_usd:dayCost/1e9,daily_limit_pct:number(key.dailyLimitRequests)>0?dayReqs/number(key.dailyLimitRequests)*100:null} };
	});
}
