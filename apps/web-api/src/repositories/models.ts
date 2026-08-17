import { gatewayProviderHealthStates, v2BenchmarkResults, v2Benchmarks, v2Labs, v2ModelAliases, v2ModelPageNotices, v2ModelProviderRoutes, v2Models, v2PricingSkuMeters, v2PricingSkus, v2ProviderRegions, v2Providers, v2RouteVariants, v2SubscriptionPlanModels, v2SubscriptionPlans } from "@phaseo/db/schema";
import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lte, ne, notInArray, or, sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export type PublicModelIdentity = {
	model_slug: string;
	name: string;
	description: string | null;
	status: string;
	catalogue_status: string;
	hidden: boolean;
	variant_kind: string;
	base_model_slug: string | null;
	previous_model_slug: string | null;
	replacement_model_slug: string | null;
	announced_at: string | null;
	released_at: string | null;
	deprecated_at: string | null;
	retired_at: string | null;
	removal_date: string | null;
	family_slug: string | null;
	license: string | null;
	license_url: string | null;
	input_modalities: string[];
	output_modalities: string[];
	lab_slug: string;
	lab_name: string;
	lab_country_code: string;
};

export type ModelResolution = {
	requestedModelId: string;
	canonicalModelId: string | null;
	internalModelId: string | null;
	source: "direct" | "alias" | "provider_mapping" | "unresolved";
};

export type ModelVariantSummary = {
	model_id: string;
	name: string;
	variant_kind: string;
};

export type ModelAvailability = {
	is_gateway_active: boolean;
	active_provider_count: number;
	active_route_count: number;
	regions: string[];
	service_tiers: string[];
};

export type ModelBenchmarkRow = {
	result_id: string;
	benchmark_id: string;
	score: string | null;
	score_numeric: string | null;
	is_self_reported: boolean;
	other_info: string | null;
	source_link: string | null;
	result_rank: number | null;
	occur_idx: number | null;
	variant: string | null;
	result_key: string | null;
	benchmark_name: string;
	category: string | null;
	link: string | null;
	total_models: number | null;
	ascending_order: boolean;
	benchmark_type: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type ModelTimelineEvent = Record<string, string>;

export async function findPublicModelIdentity(
	env: Env,
	modelSlug: string,
): Promise<PublicModelIdentity | null> {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db
			.select({
				model_slug: v2Models.modelSlug,
				name: v2Models.name,
				description: v2Models.description,
				status: v2Models.status,
				catalogue_status: v2Models.catalogueStatus,
				hidden: v2Models.hidden,
				variant_kind: v2Models.variantKind,
				base_model_slug: v2Models.baseModelSlug,
				previous_model_slug: v2Models.previousModelSlug,
				replacement_model_slug: v2Models.replacementModelSlug,
				announced_at: v2Models.announcedAt,
				released_at: v2Models.releasedAt,
				deprecated_at: v2Models.deprecatedAt,
				retired_at: v2Models.retiredAt,
				removal_date: v2Models.removalDate,
				family_slug: v2Models.familySlug,
				license: v2Models.license,
				license_url: v2Models.licenseUrl,
				input_modalities: v2Models.inputModalities,
				output_modalities: v2Models.outputModalities,
				lab_slug: v2Labs.labSlug,
				lab_name: v2Labs.name,
				lab_country_code: v2Labs.countryCode,
			})
			.from(v2Models)
			.innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug))
			.where(and(
				eq(v2Models.modelSlug, modelSlug.trim().toLowerCase()),
				eq(v2Models.hidden, false),
				ne(v2Models.status, "disabled"),
			))
			.limit(1);
		return row ?? null;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function resolvePublicModel(
	env: Env,
	requestedModelId: string,
): Promise<ModelResolution> {
	const { db, client } = createDatabase(env);
	const slug = requestedModelId.trim().toLowerCase();
	const now = new Date().toISOString();
	try {
		const [directRows, aliasRows, routeRows] = await Promise.all([
			db.select({ modelSlug: v2Models.modelSlug }).from(v2Models).where(and(
				eq(v2Models.modelSlug, slug),
				eq(v2Models.hidden, false),
				ne(v2Models.status, "disabled"),
			)).limit(1),
			db.select({ modelSlug: v2ModelAliases.modelSlug }).from(v2ModelAliases).where(and(
				eq(v2ModelAliases.aliasSlug, slug),
				eq(v2ModelAliases.enabled, true),
				or(isNull(v2ModelAliases.effectiveFrom), lte(v2ModelAliases.effectiveFrom, now)),
				or(isNull(v2ModelAliases.effectiveTo), gt(v2ModelAliases.effectiveTo, now)),
			)).limit(1),
			db.select({ modelSlug: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(or(
				eq(v2ModelProviderRoutes.providerModelId, slug),
				eq(v2ModelProviderRoutes.providerModelSlug, slug),
			)).orderBy(desc(sql`${v2ModelProviderRoutes.status} = 'active'`), asc(v2ModelProviderRoutes.providerModelId)).limit(1),
		]);
		const match = directRows[0] ?? aliasRows[0] ?? routeRows[0] ?? null;
		const source = directRows[0] ? "direct" : aliasRows[0] ? "alias" : routeRows[0] ? "provider_mapping" : "unresolved";
		return {
			requestedModelId,
			canonicalModelId: match?.modelSlug ?? null,
			internalModelId: match?.modelSlug ?? null,
			source,
		};
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listPublicModelVariants(
	env: Env,
	modelSlug: string,
): Promise<ModelVariantSummary[]> {
	const { db, client } = createDatabase(env);
	const slug = modelSlug.trim().toLowerCase();
	try {
		const [requested] = await db
			.select({ modelSlug: v2Models.modelSlug, baseModelSlug: v2Models.baseModelSlug })
			.from(v2Models)
			.where(and(
				eq(v2Models.modelSlug, slug),
				eq(v2Models.hidden, false),
				ne(v2Models.status, "disabled"),
			))
			.limit(1);
		if (!requested) return [];

		const baseModelSlug = requested.baseModelSlug ?? requested.modelSlug;
		return await db
			.select({
				model_id: v2Models.modelSlug,
				name: v2Models.name,
				variant_kind: v2Models.variantKind,
			})
			.from(v2Models)
			.where(and(
				or(
					eq(v2Models.modelSlug, baseModelSlug),
					eq(v2Models.baseModelSlug, baseModelSlug),
				),
				eq(v2Models.hidden, false),
				ne(v2Models.status, "disabled"),
			))
			.orderBy(
				asc(sql`case when ${v2Models.variantKind} = 'standard' then 0 else 1 end`),
				asc(v2Models.name),
				asc(v2Models.modelSlug),
			);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getModelAvailability(
	env: Env,
	input: { modelSlug: string; region?: string | null; serviceTier?: string | null },
): Promise<ModelAvailability> {
	const { db, client } = createDatabase(env);
	const region = input.region?.trim().toLowerCase() || null;
	const serviceTier = input.serviceTier?.trim().toLowerCase() || null;
	try {
		const conditions = [
			eq(v2ModelProviderRoutes.modelSlug, input.modelSlug.trim().toLowerCase()),
			inArray(v2ModelProviderRoutes.status, ["active", "degraded"]),
			notInArray(v2Providers.status, ["disabled", "deprecated", "external"]),
			inArray(v2RouteVariants.status, ["active", "degraded"]),
		];
		if (serviceTier) conditions.push(eq(v2RouteVariants.serviceTierSlug, serviceTier));
		if (region) conditions.push(or(
			eq(sql<string>`lower(coalesce(${v2RouteVariants.executionRegion}, ''))`, region),
			eq(sql<string>`lower(coalesce(${v2RouteVariants.dataRegion}, ''))`, region),
		)!);

		const rows = await db
			.select({
				providerSlug: v2ModelProviderRoutes.providerSlug,
				providerModelId: v2ModelProviderRoutes.providerModelId,
				executionRegion: v2RouteVariants.executionRegion,
				dataRegion: v2RouteVariants.dataRegion,
				serviceTier: v2RouteVariants.serviceTierSlug,
				routeEnabled: v2ModelProviderRoutes.routingEnabled,
				providerEnabled: v2Providers.routingEnabled,
				variantEnabled: v2RouteVariants.routingEnabled,
			})
			.from(v2ModelProviderRoutes)
			.innerJoin(v2Providers, eq(v2Providers.providerSlug, v2ModelProviderRoutes.providerSlug))
			.innerJoin(v2RouteVariants, eq(v2RouteVariants.providerModelId, v2ModelProviderRoutes.providerModelId))
			.where(and(...conditions));

		const activeRows = rows.filter((row) => row.routeEnabled && row.providerEnabled && row.variantEnabled);
		const regions = new Set<string>();
		const serviceTiers = new Set<string>();
		for (const row of rows) {
			if (row.executionRegion) regions.add(row.executionRegion);
			if (row.dataRegion) regions.add(row.dataRegion);
			serviceTiers.add(row.serviceTier);
		}
		return {
			is_gateway_active: activeRows.length > 0,
			active_provider_count: new Set(activeRows.map((row) => row.providerSlug)).size,
			active_route_count: new Set(activeRows.map((row) => row.providerModelId)).size,
			regions: [...regions].sort(),
			service_tiers: [...serviceTiers].sort(),
		};
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listModelBenchmarks(
	env: Env,
	modelSlug: string,
): Promise<ModelBenchmarkRow[]> {
	const { db, client } = createDatabase(env);
	try {
		return await db
			.select({
				result_id: v2BenchmarkResults.resultId,
				benchmark_id: v2BenchmarkResults.benchmarkId,
				score: v2BenchmarkResults.score,
				score_numeric: v2BenchmarkResults.scoreNumeric,
				is_self_reported: v2BenchmarkResults.isSelfReported,
				other_info: v2BenchmarkResults.otherInfo,
				source_link: v2BenchmarkResults.sourceLink,
				result_rank: v2BenchmarkResults.rank,
				occur_idx: v2BenchmarkResults.occurIdx,
				variant: v2BenchmarkResults.variant,
				result_key: v2BenchmarkResults.resultKey,
				benchmark_name: v2Benchmarks.name,
				category: v2Benchmarks.category,
				link: v2Benchmarks.link,
				total_models: v2Benchmarks.totalModels,
				ascending_order: v2Benchmarks.ascendingOrder,
				benchmark_type: v2Benchmarks.benchmarkType,
				created_at: v2BenchmarkResults.createdAt,
				updated_at: v2BenchmarkResults.updatedAt,
			})
			.from(v2BenchmarkResults)
			.innerJoin(v2Benchmarks, eq(v2Benchmarks.benchmarkId, v2BenchmarkResults.benchmarkId))
			.where(eq(v2BenchmarkResults.modelSlug, modelSlug.trim().toLowerCase()))
			.orderBy(
				asc(v2Benchmarks.name),
				sql`${v2BenchmarkResults.rank} asc nulls last`,
				desc(v2BenchmarkResults.createdAt),
			);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getModelTimeline(
	env: Env,
	modelSlug: string,
): Promise<ModelTimelineEvent[] | null> {
	const { db, client } = createDatabase(env);
	const slug = modelSlug.trim().toLowerCase();
	try {
		const [model] = await db
			.select({
				modelSlug: v2Models.modelSlug,
				name: v2Models.name,
				previousModelSlug: v2Models.previousModelSlug,
				announcedAt: v2Models.announcedAt,
				releasedAt: v2Models.releasedAt,
				deprecatedAt: v2Models.deprecatedAt,
				retiredAt: v2Models.retiredAt,
			})
			.from(v2Models)
			.where(and(eq(v2Models.modelSlug, slug), eq(v2Models.hidden, false)))
			.limit(1);
		if (!model) return null;

		const [previousRows, futureRows] = await Promise.all([
			model.previousModelSlug
				? db.select({ modelSlug: v2Models.modelSlug, name: v2Models.name, announcedAt: v2Models.announcedAt, releasedAt: v2Models.releasedAt })
					.from(v2Models).where(and(eq(v2Models.modelSlug, model.previousModelSlug), eq(v2Models.hidden, false))).limit(1)
				: Promise.resolve([]),
			db.select({ modelSlug: v2Models.modelSlug, name: v2Models.name, announcedAt: v2Models.announcedAt, releasedAt: v2Models.releasedAt })
				.from(v2Models).where(and(eq(v2Models.previousModelSlug, slug), eq(v2Models.hidden, false))),
		]);

		const events: ModelTimelineEvent[] = [];
		for (const [date, eventName] of [[model.announcedAt, "Announced"], [model.releasedAt, "Released"], [model.deprecatedAt, "Deprecated"], [model.retiredAt, "Retired"]] as const) {
			if (date) events.push({ date, eventType: "ModelEvent", eventName });
		}
		const previous = previousRows[0];
		const previousDate = previous?.releasedAt ?? previous?.announcedAt;
		if (previous && previousDate) events.push({ date: previousDate, eventType: "PreviousModel", modelId: previous.modelSlug, modelName: previous.name });
		const future = futureRows
			.map((candidate) => ({ candidate, date: candidate.releasedAt ?? candidate.announcedAt }))
			.filter((entry): entry is { candidate: typeof entry.candidate; date: string } => Boolean(entry.date))
			.sort((left, right) => left.date.localeCompare(right.date))[0];
		if (future) events.push({ date: future.date, eventType: "FutureModel", modelId: future.candidate.modelSlug, modelName: future.candidate.name });
		return events.sort((left, right) => right.date.localeCompare(left.date));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listModelSubscriptionPlans(env: Env, modelSlug: string) {
	const { db, client } = createDatabase(env);
	try {
		return await db
			.select({
				plan_uuid: v2SubscriptionPlans.planUuid,
				plan_id: v2SubscriptionPlans.planId,
				name: v2SubscriptionPlans.name,
				lab_slug: v2SubscriptionPlans.labSlug,
				description: v2SubscriptionPlans.description,
				link: v2SubscriptionPlans.link,
				other_info: v2SubscriptionPlans.otherInfo,
				created_at: v2SubscriptionPlans.createdAt,
				updated_at: v2SubscriptionPlans.updatedAt,
				model_info: v2SubscriptionPlanModels.modelInfo,
				rate_limit: v2SubscriptionPlanModels.rateLimit,
				model_other_info: v2SubscriptionPlanModels.otherInfo,
				price: v2SubscriptionPlans.price,
				currency: v2SubscriptionPlans.currency,
				frequency: v2SubscriptionPlans.frequency,
			})
			.from(v2SubscriptionPlanModels)
			.innerJoin(v2SubscriptionPlans, eq(v2SubscriptionPlans.planUuid, v2SubscriptionPlanModels.planUuid))
			.where(eq(v2SubscriptionPlanModels.modelSlug, modelSlug.trim().toLowerCase()))
			.orderBy(asc(v2SubscriptionPlans.planId), asc(v2SubscriptionPlans.frequency));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listModelIdentifiers(env: Env, modelSlug: string): Promise<string[]> {
	const { db, client } = createDatabase(env);
	const slug = modelSlug.trim().toLowerCase();
	const now = new Date().toISOString();
	try {
		const [routes, aliases] = await Promise.all([
			db.select({
				modelSlug: v2ModelProviderRoutes.modelSlug,
				providerModelId: v2ModelProviderRoutes.providerModelId,
				providerModelSlug: v2ModelProviderRoutes.providerModelSlug,
			}).from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.modelSlug, slug)),
			db.select({ aliasSlug: v2ModelAliases.aliasSlug }).from(v2ModelAliases).where(and(
				eq(v2ModelAliases.modelSlug, slug),
				eq(v2ModelAliases.enabled, true),
				or(isNull(v2ModelAliases.effectiveFrom), lte(v2ModelAliases.effectiveFrom, now)),
				or(isNull(v2ModelAliases.effectiveTo), gt(v2ModelAliases.effectiveTo, now)),
			)),
		]);
		const identifiers = new Set([slug]);
		for (const route of routes) {
			identifiers.add(route.modelSlug);
			identifiers.add(route.providerModelId);
			identifiers.add(route.providerModelSlug);
		}
		for (const alias of aliases) identifiers.add(alias.aliasSlug);
		return [...identifiers].filter(Boolean);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getModelNotice(
	env: Env,
	requestedModelId: string,
): Promise<{ apiModelId: string; tone: "info" | "warning" | "critical"; markdown: string } | null> {
	const { db, client } = createDatabase(env);
	const slug = requestedModelId.trim().toLowerCase();
	const now = new Date().toISOString();
	try {
		const [aliasRows, modelRows, routeIdRows, routeSlugRows] = await Promise.all([
			db.select({ modelSlug: v2ModelAliases.modelSlug }).from(v2ModelAliases).where(and(
				eq(v2ModelAliases.aliasSlug, slug),
				eq(v2ModelAliases.enabled, true),
				or(isNull(v2ModelAliases.effectiveFrom), lte(v2ModelAliases.effectiveFrom, now)),
				or(isNull(v2ModelAliases.effectiveTo), gt(v2ModelAliases.effectiveTo, now)),
			)).limit(1),
			db.select({ modelSlug: v2Models.modelSlug }).from(v2Models).where(and(
				eq(v2Models.modelSlug, slug), eq(v2Models.hidden, false), ne(v2Models.status, "disabled"),
			)).limit(1),
			db.select({ modelSlug: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes)
				.where(eq(v2ModelProviderRoutes.providerModelId, slug)).limit(1),
			db.select({ modelSlug: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes)
				.where(eq(v2ModelProviderRoutes.providerModelSlug, slug)).limit(1),
		]);
		const modelSlug = aliasRows[0]?.modelSlug ?? modelRows[0]?.modelSlug ?? routeIdRows[0]?.modelSlug ?? routeSlugRows[0]?.modelSlug;
		if (!modelSlug) return null;
		const [notice] = await db.select({ tone: v2ModelPageNotices.tone, markdown: v2ModelPageNotices.markdown })
			.from(v2ModelPageNotices).where(eq(v2ModelPageNotices.modelSlug, modelSlug)).limit(1);
		const tone = notice?.tone;
		const markdown = notice?.markdown.trim();
		if (!markdown || (tone !== "info" && tone !== "warning" && tone !== "critical")) return null;
		return { apiModelId: modelSlug, tone, markdown };
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getProviderStatuses(
	env: Env,
	providerIds: string[],
): Promise<Map<string, string>> {
	const normalized = [...new Set(providerIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
	if (!normalized.length) return new Map();
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ providerSlug: v2Providers.providerSlug, status: v2Providers.status })
			.from(v2Providers).where(inArray(v2Providers.providerSlug, normalized));
		return new Map(rows.map((row) => [row.providerSlug, row.status]));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getProviderMetadata(
	env: Env,
	providerIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
	const normalized = [...new Set(providerIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
	if (!normalized.length) return new Map();
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ providerSlug: v2Providers.providerSlug, metadata: v2Providers.metadata })
			.from(v2Providers).where(inArray(v2Providers.providerSlug, normalized));
		return new Map(rows.map((row) => [row.providerSlug, row.metadata as Record<string, unknown>]));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getProviderRegions(
	env: Env,
	providerIds: string[],
): Promise<Map<string, string[]>> {
	const normalized = [...new Set(providerIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
	if (!normalized.length) return new Map();
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ providerSlug: v2ProviderRegions.providerSlug, regionCode: v2ProviderRegions.regionCode })
			.from(v2ProviderRegions).where(and(
				inArray(v2ProviderRegions.providerSlug, normalized),
				ne(v2ProviderRegions.status, "disabled"),
				eq(v2ProviderRegions.routingEnabled, true),
			)).orderBy(asc(v2ProviderRegions.providerSlug), asc(v2ProviderRegions.regionCode));
		const result = new Map<string, string[]>();
		for (const row of rows) {
			const regions = result.get(row.providerSlug) ?? [];
			if (!regions.includes(row.regionCode)) regions.push(row.regionCode);
			result.set(row.providerSlug, regions);
		}
		return result;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listRecentProviderHealthStates(
	env: Env,
	providerIds: string[],
	since: string,
) {
	const normalized = [...new Set(providerIds.map((id) => id.trim()).filter(Boolean))];
	if (!normalized.length) return [];
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			provider_id: gatewayProviderHealthStates.providerId,
			breaker_state: gatewayProviderHealthStates.breakerState,
			is_deranked: gatewayProviderHealthStates.isDeranked,
			open_until_ms: gatewayProviderHealthStates.openUntilMs,
			updated_at: gatewayProviderHealthStates.updatedAt,
		}).from(gatewayProviderHealthStates).where(and(
			inArray(gatewayProviderHealthStates.providerId, normalized),
			gte(gatewayProviderHealthStates.updatedAt, since),
		)).orderBy(desc(gatewayProviderHealthStates.updatedAt)).limit(20_000);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listCatalogPricingRules(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			provider_slug: v2ModelProviderRoutes.providerSlug,
			model_slug: v2ModelProviderRoutes.modelSlug,
			service_tier_slug: v2PricingSkus.serviceTierSlug,
			meter_key: v2PricingSkuMeters.meterKey,
			description: v2PricingSkus.description,
			unit: v2PricingSkuMeters.unit,
			unit_quantity: v2PricingSkuMeters.unitQuantity,
			price_nanos: v2PricingSkuMeters.priceNanos,
			effective_from: v2PricingSkus.effectiveFrom,
			effective_to: v2PricingSkus.effectiveTo,
		}).from(v2PricingSkuMeters)
			.innerJoin(v2PricingSkus, eq(v2PricingSkus.skuId, v2PricingSkuMeters.skuId))
			.innerJoin(v2ModelProviderRoutes, eq(v2ModelProviderRoutes.providerModelId, v2PricingSkus.providerModelId))
			.where(ne(v2PricingSkus.status, "disabled"));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listPublicCatalogueModels(
	env: Env,
	input: { search?: string | null; limit: number; offset: number },
) {
	const { db, client } = createDatabase(env);
	const conditions = [eq(v2Models.hidden, false), ne(v2Models.status, "disabled")];
	const search = input.search?.trim();
	if (search) conditions.push(ilike(v2Models.name, `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`));
	try {
		const [rows, countRows] = await Promise.all([
			db.select({
				model_slug: v2Models.modelSlug,
				lab_slug: v2Models.labSlug,
				name: v2Models.name,
				description: v2Models.description,
				status: v2Models.status,
				released_at: v2Models.releasedAt,
				announced_at: v2Models.announcedAt,
				updated_at: v2Models.updatedAt,
				input_modalities: v2Models.inputModalities,
				output_modalities: v2Models.outputModalities,
				organisation_name: v2Labs.name,
				organisation_metadata: v2Labs.metadata,
			}).from(v2Models)
				.innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug))
				.where(and(...conditions)).orderBy(asc(v2Models.name))
				.limit(Math.max(1, input.limit)).offset(Math.max(0, input.offset)),
			db.select({ count: sql<number>`count(*)::int` }).from(v2Models).where(and(...conditions)),
		]);
		return {
			rows: rows.map(({ organisation_name, organisation_metadata, ...row }) => ({
				...row,
				organisation: { name: organisation_name, metadata: organisation_metadata },
			})),
			total: Number(countRows[0]?.count ?? 0),
		};
	} finally {
		await client.end({ timeout: 1 });
	}
}
