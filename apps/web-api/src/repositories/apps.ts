import { apiApps, gatewayRequests, v2ModelProviderRoutes, v2RpcPublicAppModelUsageDaily, v2WebPublicUsageDaily, v2WebPublicUsageHourly } from "@phaseo/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listPublicAppIds(env: Env): Promise<string[]> {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ id: apiApps.id }).from(apiApps)
			.where(eq(apiApps.isPublic, true)).orderBy(asc(apiApps.id));
		return rows.map((row) => row.id);
	} finally { await client.end({ timeout: 1 }); }
}

export async function getPublicAppImages(env: Env, appIds: string[]) {
	const ids = [...new Set(appIds)].filter(Boolean);
	if (!ids.length) return new Map<string, string | null>();
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ id: apiApps.id, imageUrl: apiApps.imageUrl }).from(apiApps)
			.where(and(inArray(apiApps.id, ids), eq(apiApps.isPublic, true)));
		return new Map(rows.map((row) => [row.id, row.imageUrl]));
	} finally { await client.end({ timeout: 1 }); }
}

export async function listWorkspaceApps(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			id: apiApps.id,
			title: apiApps.title,
			appKey: apiApps.appKey,
			url: apiApps.url,
			imageUrl: apiApps.imageUrl,
			isPublic: apiApps.isPublic,
			isActive: apiApps.isActive,
			lastSeen: apiApps.lastSeen,
			createdAt: apiApps.createdAt,
			meta: apiApps.meta,
		}).from(apiApps).where(eq(apiApps.workspaceId, workspaceId)).orderBy(desc(apiApps.lastSeen));
	} finally { await client.end({ timeout: 1 }); }
}

export async function findAccountApp(env: Env, appId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({
			id: apiApps.id,
			workspaceId: apiApps.workspaceId,
			title: apiApps.title,
			appKey: apiApps.appKey,
		}).from(apiApps).where(eq(apiApps.id, appId)).limit(1);
		return row ?? null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function findAccountApps(env: Env, appIds: string[]) {
	const ids = [...new Set(appIds)].filter(Boolean);
	if (!ids.length) return [];
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			id: apiApps.id,
			workspaceId: apiApps.workspaceId,
			title: apiApps.title,
			appKey: apiApps.appKey,
		}).from(apiApps).where(inArray(apiApps.id, ids));
	} finally { await client.end({ timeout: 1 }); }
}

export async function updateAccountApp(
	env: Env,
	input: {
		appId: string;
		workspaceId: string;
		values: Partial<Pick<typeof apiApps.$inferInsert, "title" | "url" | "imageUrl" | "isPublic" | "isActive">>;
		category?: string | null;
		docsUrl?: string | null;
	},
) {
	const { db, client } = createDatabase(env);
	try {
		return await db.transaction(async (tx) => {
			const [current] = await tx.select({ meta: apiApps.meta }).from(apiApps)
				.where(and(eq(apiApps.id, input.appId), eq(apiApps.workspaceId, input.workspaceId))).limit(1);
			if (!current) return null;
			const meta = current.meta && typeof current.meta === "object" && !Array.isArray(current.meta)
				? { ...current.meta as Record<string, unknown> }
				: {};
			if (input.category !== undefined) meta.category = input.category;
			if (input.docsUrl !== undefined) meta.docs_url = input.docsUrl;
			const [row] = await tx.update(apiApps).set({ ...input.values, meta, updatedAt: new Date().toISOString() })
				.where(and(eq(apiApps.id, input.appId), eq(apiApps.workspaceId, input.workspaceId)))
				.returning({ id: apiApps.id, isPublic: apiApps.isPublic, isActive: apiApps.isActive, imageUrl: apiApps.imageUrl });
			return row ?? null;
		});
	} finally { await client.end({ timeout: 1 }); }
}

export async function listProviderModelMappings(
	env: Env,
	modelIds: string[],
	providerIds: string[],
) {
	const models = [...new Set(modelIds)].filter(Boolean);
	if (!models.length) return [];
	const providers = [...new Set(providerIds)].filter(Boolean);
	const { db, client } = createDatabase(env);
	try {
		const conditions = [inArray(v2ModelProviderRoutes.providerModelSlug, models)];
		if (providers.length) conditions.push(inArray(v2ModelProviderRoutes.providerSlug, providers));
		return await db.select({
			provider_id: v2ModelProviderRoutes.providerSlug,
			api_model_id: v2ModelProviderRoutes.providerModelSlug,
			model_id: v2ModelProviderRoutes.modelSlug,
		}).from(v2ModelProviderRoutes).where(and(...conditions));
	} finally { await client.end({ timeout: 1 }); }
}

export async function getPublicAppNames(env: Env, appIds: string[]) {
	const ids = [...new Set(appIds)].filter(Boolean);
	if (!ids.length) return new Map<string, string>();
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ id: apiApps.id, title: apiApps.title }).from(apiApps)
			.where(and(inArray(apiApps.id, ids), eq(apiApps.isPublic, true)));
		return new Map(rows.map((row) => [row.id, row.title]));
	} finally { await client.end({ timeout: 1 }); }
}

export async function findPublicApp(env: Env, reference: string) {
	const { db, client } = createDatabase(env);
	try {
		const referenceCondition = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)
			? eq(apiApps.id, reference)
			: eq(apiApps.appKey, reference);
		const [row] = await db.select().from(apiApps).where(and(eq(apiApps.isPublic, true), referenceCondition)).limit(1);
		return row ? { ...row, slug: row.appKey } : null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function listAppUsage(
	env: Env,
	input: { appId: string; from: string; to: string; daily: boolean },
) {
	const { db, client } = createDatabase(env);
	try {
		if (input.daily) {
			return await db.select({
				created_at: v2WebPublicUsageDaily.dayBucket,
				model_id: v2WebPublicUsageDaily.canonicalModelId,
				requests: v2WebPublicUsageDaily.requests,
				successful_requests: v2WebPublicUsageDaily.successRequests,
				total_tokens: v2WebPublicUsageDaily.totalTokens,
				cost_nanos: v2WebPublicUsageDaily.totalCostNanos,
			}).from(v2WebPublicUsageDaily).where(and(
				eq(v2WebPublicUsageDaily.appId, input.appId),
				gte(v2WebPublicUsageDaily.dayBucket, input.from.slice(0, 10)),
				lte(v2WebPublicUsageDaily.dayBucket, input.to.slice(0, 10)),
			)).orderBy(asc(v2WebPublicUsageDaily.dayBucket)).limit(40_000);
		}
		return await db.select({
			created_at: v2WebPublicUsageHourly.bucket15M,
			model_id: v2WebPublicUsageHourly.canonicalModelId,
			requests: v2WebPublicUsageHourly.requests,
			successful_requests: v2WebPublicUsageHourly.successRequests,
			total_tokens: v2WebPublicUsageHourly.totalTokens,
			cost_nanos: v2WebPublicUsageHourly.totalCostNanos,
		}).from(v2WebPublicUsageHourly).where(and(
			eq(v2WebPublicUsageHourly.appId, input.appId),
			gte(v2WebPublicUsageHourly.bucket15M, input.from),
			lte(v2WebPublicUsageHourly.bucket15M, input.to),
		)).orderBy(asc(v2WebPublicUsageHourly.bucket15M)).limit(40_000);
	} finally { await client.end({ timeout: 1 }); }
}

export async function listRecentAppRequests(env: Env, appId: string, requestedLimit: number) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			created_at: gatewayRequests.createdAt,
			usage: gatewayRequests.usage,
			cost_nanos: gatewayRequests.costNanos,
			model_id: gatewayRequests.modelId,
			provider: gatewayRequests.provider,
			success: gatewayRequests.success,
		}).from(gatewayRequests).where(eq(gatewayRequests.appId, appId))
			.orderBy(desc(gatewayRequests.createdAt)).limit(Math.max(1, Math.min(100, requestedLimit)));
	} finally { await client.end({ timeout: 1 }); }
}

export async function getAppUsageSummary(env: Env, appId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({
			totalTokens: sql<string>`coalesce(sum(${v2WebPublicUsageDaily.totalTokens}), 0)`,
			totalRequests: sql<number>`coalesce(sum(${v2WebPublicUsageDaily.successRequests}), 0)::bigint`,
		}).from(v2WebPublicUsageDaily).where(eq(v2WebPublicUsageDaily.appId, appId));
		return { totalTokens: Number(row?.totalTokens ?? 0), totalRequests: Number(row?.totalRequests ?? 0) };
	} finally { await client.end({ timeout: 1 }); }
}

export async function listTopApps(env: Env, timeRange: string, requestedLimit: number) {
	const days = timeRange === "today" ? 0 : timeRange === "4w" ? 28 : timeRange === "month" ? 30 : 7;
	const since = new Date();
	since.setUTCDate(since.getUTCDate() - days);
	const { db, client } = createDatabase(env);
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			with grouped as (
				select usage.app_id,
					sum(usage.requests)::bigint as requests,
					sum(usage.tokens)::bigint as tokens,
					count(distinct usage.model_id)::int as unique_models
				from ${v2RpcPublicAppModelUsageDaily} usage
				where usage.day_bucket >= ${since.toISOString().slice(0, 10)}::date
				group by usage.app_id
			)
			select grouped.app_id,
				coalesce(app.title, 'App-' || substring(md5(grouped.app_id), 1, 8)) as app_name,
				grouped.requests, grouped.tokens, grouped.unique_models
			from grouped left join ${apiApps} app on app.id::text = grouped.app_id
			order by grouped.requests desc, grouped.tokens desc
			limit ${Math.max(1, Math.min(100, requestedLimit))}
		`);
		return [...result];
	} finally { await client.end({ timeout: 1 }); }
}

export async function listTrendingApps(env: Env, requestedLimit: number, minimumWeekTokens: number) {
	const { db, client } = createDatabase(env);
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			with weekly as (
				select usage.app_id,
					sum(usage.tokens) filter (where usage.day_bucket >= current_date - 7)::bigint as current_week_tokens,
					sum(usage.tokens) filter (where usage.day_bucket >= current_date - 14 and usage.day_bucket < current_date - 7)::bigint as previous_week_tokens
				from ${v2RpcPublicAppModelUsageDaily} usage
				where usage.day_bucket >= current_date - 14
				group by usage.app_id
			)
			select weekly.app_id,
				coalesce(app.title, 'App-' || substring(md5(weekly.app_id), 1, 8)) as app_name,
				coalesce(weekly.current_week_tokens, 0)::bigint as current_week_tokens,
				coalesce(weekly.previous_week_tokens, 0)::bigint as previous_week_tokens,
				(coalesce(weekly.current_week_tokens, 0) - coalesce(weekly.previous_week_tokens, 0))::bigint as growth_tokens,
				case when coalesce(weekly.previous_week_tokens, 0) > 0
					then round(((coalesce(weekly.current_week_tokens, 0) - weekly.previous_week_tokens)::numeric / weekly.previous_week_tokens) * 100, 2)
					when coalesce(weekly.current_week_tokens, 0) > 0 then null else 0 end as growth_pct
			from weekly left join ${apiApps} app on app.id::text = weekly.app_id
			where coalesce(weekly.current_week_tokens, 0) > coalesce(weekly.previous_week_tokens, 0)
				and coalesce(weekly.current_week_tokens, 0) >= ${Math.max(0, minimumWeekTokens)}
			order by growth_tokens desc, current_week_tokens desc
			limit ${Math.max(1, Math.min(100, requestedLimit))}
		`);
		return [...result];
	} finally { await client.end({ timeout: 1 }); }
}

/**
 * Moves an app's immutable request history and invalidates every derived grain.
 * Rebuilding is delegated to the existing analytics outbox so the transaction
 * stays bounded even for large PlanetScale datasets.
 */
export async function mergeAppHistory(env: Env, input: { workspaceId: string; sourceAppId: string; targetAppId: string }) {
	if (input.sourceAppId === input.targetAppId) throw new Error("invalid_app_merge");
	const { db, client } = createDatabase(env);
	try {
		return await db.transaction(async (tx) => {
			const lockedApps = await tx.execute<{ id: string }>(sql`
				select id from ${apiApps}
				where workspace_id=${input.workspaceId}::uuid
					and id in (${input.sourceAppId}::uuid, ${input.targetAppId}::uuid)
				order by id for update
			`);
			if (lockedApps.length !== 2) throw new Error("app_merge_target_not_found");

			const [counts] = await tx.execute<{ gateway_requests: number | string; request_facts: number | string }>(sql`
				with moved_gateway as (
					update observability.gateway_requests
					set app_id=${input.targetAppId}::uuid
					where workspace_id=${input.workspaceId}::uuid and app_id=${input.sourceAppId}::uuid
					returning 1
				), moved_facts as (
					update observability.v2_request_facts
					set app_id=${input.targetAppId}::uuid
					where workspace_id=${input.workspaceId}::uuid and app_id=${input.sourceAppId}::uuid
					returning request_event_id, workspace_id, occurred_at
				), queued as (
					insert into internal.v2_analytics_outbox (
						request_event_id, workspace_id, occurred_at, status,
						attempt_count, available_at, last_error, updated_at
					)
					select request_event_id, workspace_id, occurred_at, 'pending', 0, now(), null, now()
					from moved_facts
					on conflict (request_event_id) do update set
						status='pending', attempt_count=0, available_at=now(), last_error=null, updated_at=now()
					returning 1
				)
				select
					(select count(*) from moved_gateway)::integer as gateway_requests,
					(select count(*) from queued)::integer as request_facts
			`);

			// Meter rows cascade from their rollup parent rows. The outbox recreates
			// target-app grains from the now-authoritative request facts.
			await tx.execute(sql`delete from observability.v2_private_usage_daily where workspace_id=${input.workspaceId}::uuid and app_id=${input.sourceAppId}::uuid`);
			await tx.execute(sql`delete from observability.v2_public_usage_daily where app_id=${input.sourceAppId}::uuid`);
			await tx.execute(sql`delete from observability.v2_public_usage_hourly where app_id=${input.sourceAppId}::uuid`);
			await tx.delete(apiApps).where(and(eq(apiApps.workspaceId, input.workspaceId), eq(apiApps.id, input.sourceAppId)));

			return { gateway_requests: Number(counts?.gateway_requests ?? 0), request_facts: Number(counts?.request_facts ?? 0), rollup_rebuild: "queued" as const };
		});
	} finally { await client.end({ timeout: 1 }); }
}
