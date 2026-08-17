import {
	users,
	v2BenchmarkResults,
	v2Benchmarks,
	v2CatalogueAdminChanges,
	v2CatalogueSourceOverrides,
	v2LabLinks,
	v2Labs,
	v2MeterDefinitions,
	v2ModelAliases,
	v2ModelDetails,
	v2ModelFamilies,
	v2ModelLinks,
	v2ModelProviderRoutes,
	v2Models,
	v2PricingSkuMeters,
	v2PricingSkus,
	v2Providers,
	v2ProviderRegions,
	v2RouteCapabilities,
	v2ServiceTiers,
	v2SubscriptionPlanModels,
	v2SubscriptionPlans,
} from "@phaseo/db/schema";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

type JsonObject = Record<string, unknown>;
type CatalogueResource = "organisations" | "providers" | "benchmarks" | "subscription-plans" | "models";
type CatalogueAction = "create" | "update" | "delete";

const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const text = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const nullableText = (value: unknown) => text(value).trim() || null;
const dateText = (value: unknown) => nullableText(value);
const stringList = (value: unknown) => Array.isArray(value) ? value.map(text) : text(value).split(",");

export async function isAdminUser(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({ role: users.role }).from(users).where(eq(users.userId, userId)).limit(1);
		return String(row?.role ?? "").toLowerCase() === "admin";
	} finally { await client.end({ timeout: 1 }); }
}

function pricingRuleRows(routes: Array<Record<string, any>>, skus: Array<Record<string, any>>, meters: Array<Record<string, any>>) {
	const routeById = new Map(routes.map((route) => [String(route.provider_api_model_id ?? route.providerModelId ?? ""), route]));
	const skuById = new Map(skus.map((sku) => [String(sku.skuId ?? ""), sku]));
	return meters.flatMap((meter) => {
		const sku = skuById.get(String(meter.skuId ?? ""));
		const route = sku ? routeById.get(String(sku.providerModelId ?? "")) : null;
		if (!sku || !route) return [];
		const skuMetadata = object(sku.metadata); const meterMetadata = object(meter.metadata);
		return [{ rule_id: meter.skuMeterId, provider_id: route.provider_id, api_model_id: route.api_model_id, model_key: `${route.provider_id}:${route.api_model_id}:${sku.operation}`, capability_id: sku.operation, pricing_plan: sku.serviceTierSlug ?? "standard", meter: meter.meterKey, unit: meter.unit, unit_size: meter.unitQuantity, price_per_unit: Number(meter.priceNanos) / 1_000_000_000, currency: sku.currency, priority: meter.meterOrder, effective_from: sku.effectiveFrom, effective_to: sku.effectiveTo, match: skuMetadata.match ?? meterMetadata.match ?? [], billing_timestamp_basis: skuMetadata.billing_timestamp_basis ?? "request_start", time_windows: skuMetadata.time_windows ?? [], note: meterMetadata.note ?? sku.description ?? null }];
	});
}

function adminRouteRow(route: typeof v2ModelProviderRoutes.$inferSelect) {
	return { provider_api_model_id: route.providerModelId, model_id: route.modelSlug, provider_id: route.providerSlug, api_model_id: route.modelSlug, provider_model_slug: route.providerModelSlug, internal_model_id: route.modelSlug, is_active_gateway: route.routingEnabled, routing_status: route.status, provider_availability_status: route.providerAvailabilityStatus, phaseo_status: route.phaseoStatus, access_scope: route.accessScope, effective_from: route.effectiveFrom, effective_to: route.effectiveTo };
}

export async function loadAdminModelAuditSource(env: Env, includeHidden: boolean) {
	const { db, client } = createDatabase(env);
	try {
		const modelRows = await db.select({ model: v2Models, lab: v2Labs }).from(v2Models).innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(includeHidden ? undefined : eq(v2Models.hidden, false)).orderBy(desc(v2Models.releasedAt));
		const routeRows = await db.select().from(v2ModelProviderRoutes);
		const benchmarkRows = await db.select({ model_id: v2BenchmarkResults.modelSlug, id: v2BenchmarkResults.resultId }).from(v2BenchmarkResults);
		const skus = await db.select().from(v2PricingSkus);
		const meters = await db.select().from(v2PricingSkuMeters).where(eq(v2PricingSkuMeters.billable, true));
		const providerRows = routeRows.map(adminRouteRow);
		return {
			models: modelRows.map(({ model, lab }) => ({ model_id: model.modelSlug, name: model.name, release_date: model.releasedAt, retirement_date: model.retiredAt, status: model.status, hidden: model.hidden, input_types: model.inputModalities, output_types: model.outputModalities, organisation: { lab_slug: lab.labSlug, name: lab.name } })),
			providerRows,
			benchmarkRows,
			pricingRows: pricingRuleRows(providerRows, skus, meters),
		};
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadAdminProviderAuditSource(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const routes = (await db.select().from(v2ModelProviderRoutes)).map(adminRouteRow);
		const skus = await db.select().from(v2PricingSkus);
		const meters = await db.select().from(v2PricingSkuMeters).where(eq(v2PricingSkuMeters.billable, true));
		return { providerModels: routes, pricingRules: pricingRuleRows(routes, skus, meters) };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getAdminCatalogueCounts(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.execute<{ models: number | string; organisations: number | string; providers: number | string; benchmarks: number | string }>(sql`select (select count(*) from ${v2Models}) as models, (select count(*) from ${v2Labs}) as organisations, (select count(*) from ${v2Providers}) as providers, (select count(*) from ${v2Benchmarks}) as benchmarks`);
		return { models: Number(row?.models ?? 0), organisations: Number(row?.organisations ?? 0), providers: Number(row?.providers ?? 0), benchmarks: Number(row?.benchmarks ?? 0) };
	} finally { await client.end({ timeout: 1 }); }
}

export async function listAdminCatalogue(env: Env, input: { resource: "models" | "organisations" | "providers" | "benchmarks"; search: string; page: number; pageSize: number }) {
	const { db, client } = createDatabase(env);
	try {
		const offset = (input.page - 1) * input.pageSize;
		if (input.resource === "models") {
			const where = input.search ? or(ilike(v2Models.modelSlug, `%${input.search}%`), ilike(v2Models.name, `%${input.search}%`)) : undefined;
			const [rows, count] = await Promise.all([db.select({ model_id: v2Models.modelSlug, name: v2Models.name, created_at: v2Models.createdAt }).from(v2Models).where(where).orderBy(desc(v2Models.createdAt)).limit(input.pageSize).offset(offset), db.select({ count: sql<number>`count(*)` }).from(v2Models).where(where)]);
			return { rows, count: Number(count[0]?.count ?? 0) };
		}
		if (input.resource === "organisations") {
			const where = input.search ? or(ilike(v2Labs.labSlug, `%${input.search}%`), ilike(v2Labs.name, `%${input.search}%`)) : undefined;
			const [rows, count] = await Promise.all([db.select({ organisation_id: v2Labs.labSlug, name: v2Labs.name, created_at: v2Labs.createdAt }).from(v2Labs).where(where).orderBy(desc(v2Labs.createdAt)).limit(input.pageSize).offset(offset), db.select({ count: sql<number>`count(*)` }).from(v2Labs).where(where)]);
			return { rows, count: Number(count[0]?.count ?? 0) };
		}
		if (input.resource === "providers") {
			const where = input.search ? or(ilike(v2Providers.providerSlug, `%${input.search}%`), ilike(v2Providers.name, `%${input.search}%`)) : undefined;
			const [rows, count] = await Promise.all([db.select({ api_provider_id: v2Providers.providerSlug, api_provider_name: v2Providers.name, created_at: v2Providers.createdAt }).from(v2Providers).where(where).orderBy(desc(v2Providers.createdAt)).limit(input.pageSize).offset(offset), db.select({ count: sql<number>`count(*)` }).from(v2Providers).where(where)]);
			return { rows, count: Number(count[0]?.count ?? 0) };
		}
		const where = input.search ? or(ilike(v2Benchmarks.benchmarkId, `%${input.search}%`), ilike(v2Benchmarks.name, `%${input.search}%`), ilike(v2Benchmarks.category, `%${input.search}%`)) : undefined;
		const [rows, count] = await Promise.all([db.select({ id: v2Benchmarks.benchmarkId, name: v2Benchmarks.name, category: v2Benchmarks.category, created_at: v2Benchmarks.createdAt }).from(v2Benchmarks).where(where).orderBy(desc(v2Benchmarks.createdAt)).limit(input.pageSize).offset(offset), db.select({ count: sql<number>`count(*)` }).from(v2Benchmarks).where(where)]);
		return { rows, count: Number(count[0]?.count ?? 0) };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getAdminModelFormOptions(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const organisations = await db.select({ organisation_id: v2Labs.labSlug, name: v2Labs.name }).from(v2Labs).orderBy(asc(v2Labs.name));
		const providers = await db.select({ api_provider_id: v2Providers.providerSlug, api_provider_name: v2Providers.name }).from(v2Providers).orderBy(asc(v2Providers.name));
		const families = await db.select({ family_id: v2ModelFamilies.familySlug, family_name: v2ModelFamilies.name }).from(v2ModelFamilies).orderBy(asc(v2ModelFamilies.name));
		const benchmarks = await db.select({ id: v2Benchmarks.benchmarkId, name: v2Benchmarks.name }).from(v2Benchmarks).orderBy(asc(v2Benchmarks.name));
		const previousModels = await db.select({ model_id: v2Models.modelSlug, name: v2Models.name }).from(v2Models).orderBy(asc(v2Models.name)).limit(500);
		const subscriptionPlans = await db.select({ plan_uuid: v2SubscriptionPlans.planUuid, plan_id: v2SubscriptionPlans.planId, name: v2SubscriptionPlans.name, frequency: v2SubscriptionPlans.frequency, price: v2SubscriptionPlans.price, currency: v2SubscriptionPlans.currency }).from(v2SubscriptionPlans).orderBy(asc(v2SubscriptionPlans.name), asc(v2SubscriptionPlans.frequency)).limit(1200);
		return { organisations, providers, families, benchmarks, previousModels, subscriptionPlans };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getAdminCatalogueRecord(env: Env, resource: string, id: string) {
	const { db, client } = createDatabase(env);
	try {
		if (resource === "organisation") {
			const [row] = await db.select().from(v2Labs).where(eq(v2Labs.labSlug, id)).limit(1);
			const links = await db.select({ platform: v2LabLinks.platform, url: v2LabLinks.url }).from(v2LabLinks).where(eq(v2LabLinks.labSlug, id));
			return { row: row ? { organisation_id: row.labSlug, name: row.name, description: row.description, country_code: row.countryCode, metadata: row.metadata, colour: object(row.metadata).colour ?? null } : null, links };
		}
		if (resource === "provider") { const [row] = await db.select().from(v2Providers).where(eq(v2Providers.providerSlug, id)).limit(1); const metadata = object(row?.metadata); return { row: row ? { api_provider_id: row.providerSlug, api_provider_name: row.name, base_url: row.baseUrl, country_code: row.countryCode, metadata, description: metadata.description ?? null, link: metadata.link ?? row.baseUrl ?? null, prompt_training_policy: metadata.prompt_training_policy ?? null } : null }; }
		if (resource === "benchmark") { const [row] = await db.select().from(v2Benchmarks).where(eq(v2Benchmarks.benchmarkId, id)).limit(1); return { row: row ? { id: row.benchmarkId, name: row.name, category: row.category, link: row.link, ascending_order: row.ascendingOrder } : null }; }
		if (resource === "model") { const [row] = await db.select({ model_id: v2Models.modelSlug, name: v2Models.name }).from(v2Models).where(eq(v2Models.modelSlug, id)).limit(1); return { row: row ?? null }; }
		throw new Error("invalid_resource");
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadAdminModelSource(env: Env, requestedModelId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [alias] = await db.select({ modelSlug: v2ModelAliases.modelSlug }).from(v2ModelAliases).where(and(eq(v2ModelAliases.aliasSlug, requestedModelId), eq(v2ModelAliases.enabled, true))).limit(1);
		const modelId = alias?.modelSlug ?? requestedModelId;
		const [joined] = await db.select({ model: v2Models, lab: v2Labs }).from(v2Models).innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(eq(v2Models.modelSlug, modelId)).limit(1);
		const links = await db.select({ link_kind: v2ModelLinks.linkKind, title: v2ModelLinks.title, url: v2ModelLinks.url, metadata: v2ModelLinks.metadata }).from(v2ModelLinks).where(eq(v2ModelLinks.modelSlug, modelId));
		const details = await db.select({ detail_name: v2ModelDetails.detailName, detail_value: v2ModelDetails.detailValue, detail_order: v2ModelDetails.detailOrder }).from(v2ModelDetails).where(eq(v2ModelDetails.modelSlug, modelId)).orderBy(asc(v2ModelDetails.detailOrder));
		const model = joined ? { ...joined.model, lab: joined.lab, model_id: joined.model.modelSlug, organisation_id: joined.model.labSlug, family_id: joined.model.familySlug, announcement_date: joined.model.announcedAt, release_date: joined.model.releasedAt, deprecation_date: joined.model.deprecatedAt, retirement_date: joined.model.retiredAt, input_types: joined.model.inputModalities.join(","), output_types: joined.model.outputModalities.join(","), license: object(joined.model.metadata).license ?? null, previous_model_id: object(joined.model.metadata).previous_model_id ?? null } : null;
		return { modelId, model, links, details };
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadAdminPricingEditor(env: Env, modelId: string, canonicalTiers: readonly string[]) {
	const { db, client } = createDatabase(env);
	try {
		const [model] = await db.select({ model_slug: v2Models.modelSlug, name: v2Models.name, lab_slug: v2Models.labSlug }).from(v2Models).where(eq(v2Models.modelSlug, modelId)).limit(1);
		if (!model) return null;
		const routeRows = await db.select().from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.modelSlug, modelId)).orderBy(asc(v2ModelProviderRoutes.providerSlug));
		const routeIds = routeRows.map((row) => row.providerModelId); const providerSlugs = [...new Set(routeRows.map((row) => row.providerSlug))];
		const skuRows = routeIds.length ? await db.select().from(v2PricingSkus).where(inArray(v2PricingSkus.providerModelId, routeIds)).orderBy(desc(v2PricingSkus.effectiveFrom)) : [];
		const skuIds = skuRows.map((row) => row.skuId);
		const meterRows = skuIds.length ? await db.select().from(v2PricingSkuMeters).where(inArray(v2PricingSkuMeters.skuId, skuIds)).orderBy(asc(v2PricingSkuMeters.meterOrder)) : [];
		const tiers = await db.select().from(v2ServiceTiers).where(and(inArray(v2ServiceTiers.serviceTierSlug, [...canonicalTiers]), ne(v2ServiceTiers.status, "disabled"))).orderBy(asc(v2ServiceTiers.displayName));
		const regions = providerSlugs.length ? await db.select().from(v2ProviderRegions).where(and(inArray(v2ProviderRegions.providerSlug, providerSlugs), ne(v2ProviderRegions.status, "disabled"))).orderBy(asc(v2ProviderRegions.displayName)) : [];
		const capabilities = routeIds.length ? await db.select().from(v2RouteCapabilities).where(and(inArray(v2RouteCapabilities.providerModelId, routeIds), ne(v2RouteCapabilities.status, "disabled"))).orderBy(asc(v2RouteCapabilities.capabilityId)) : [];
		const definitions = await db.select().from(v2MeterDefinitions).where(ne(v2MeterDefinitions.status, "disabled")).orderBy(asc(v2MeterDefinitions.displayName));
		const providers = await db.select().from(v2Providers).where(ne(v2Providers.status, "disabled")).orderBy(asc(v2Providers.name));
		const routes = routeRows.map((r) => ({ provider_model_id: r.providerModelId, provider_slug: r.providerSlug, provider_model_slug: r.providerModelSlug, status: r.status, routing_enabled: r.routingEnabled, input_modalities: r.inputModalities, output_modalities: r.outputModalities, regions: r.regions, context_length: r.contextLength, max_output_tokens: r.maxOutputTokens, effective_from: r.effectiveFrom, effective_to: r.effectiveTo }));
		const skus = skuRows.map((s) => ({ sku_id: s.skuId, provider_model_id: s.providerModelId, sku_code: s.skuCode, version: s.version, operation: s.operation, status: s.status, region: s.region, service_tier_slug: s.serviceTierSlug, display_name: s.displayName, description: s.description, currency: s.currency, effective_from: s.effectiveFrom, effective_to: s.effectiveTo, metadata: s.metadata, created_at: s.createdAt, updated_at: s.updatedAt }));
		const meters = meterRows.map((m) => ({ sku_meter_id: m.skuMeterId, sku_id: m.skuId, meter_key: m.meterKey, modality: m.modality, direction: m.direction, unit: m.unit, unit_quantity: m.unitQuantity, price_nanos: m.priceNanos, display_label: m.displayLabel, display_unit: m.displayUnit, billable: m.billable, meter_order: m.meterOrder, metadata: m.metadata }));
		return { model, routes, skus, meters, serviceTiers: tiers.map((t) => ({ service_tier_slug: t.serviceTierSlug, display_name: t.displayName, status: t.status })), regions: regions.map((r) => ({ provider_slug: r.providerSlug, region_code: r.regionCode, display_name: r.displayName, status: r.status })), capabilities: capabilities.map((r) => ({ provider_model_id: r.providerModelId, capability_id: r.capabilityId, status: r.status })), meterDefinitions: definitions.map((m) => ({ meter_key: m.meterKey, display_name: m.displayName, modality: m.modality, direction: m.direction, unit: m.unit, default_unit_quantity: m.defaultUnitQuantity, status: m.status })), providers: providers.map((p) => ({ provider_slug: p.providerSlug, name: p.name, status: p.status, routing_enabled: p.routingEnabled, routable: p.routable, base_url: p.baseUrl, metadata: p.metadata })) };
	} finally { await client.end({ timeout: 1 }); }
}

async function assertAdmin(tx: any, actorUserId: string) {
	const [actor] = await tx.select({ role: users.role }).from(users).where(eq(users.userId, actorUserId)).limit(1);
	if (String(actor?.role ?? "").toLowerCase() !== "admin") throw new Error("actor must have the admin role");
}

async function recordOverride(tx: any, input: { actorUserId: string; sourceType: string; sourceKey: string; disposition: string; resourceId: string }) {
	await tx.insert(v2CatalogueSourceOverrides).values({
		sourceType: input.sourceType,
		sourceKey: input.sourceKey,
		disposition: input.disposition,
		actorUserId: input.actorUserId,
		resourceId: input.resourceId,
		updatedAt: new Date().toISOString(),
	}).onConflictDoUpdate({
		target: [v2CatalogueSourceOverrides.sourceType, v2CatalogueSourceOverrides.sourceKey],
		set: { disposition: input.disposition, actorUserId: input.actorUserId, resourceId: input.resourceId, updatedAt: new Date().toISOString() },
	});
}

async function audit(tx: any, input: { actorUserId: string; resourceType: string; resourceId: string; action: string; before: unknown; after: unknown }) {
	await tx.insert(v2CatalogueAdminChanges).values({ actorUserId: input.actorUserId, resourceType: input.resourceType, resourceId: input.resourceId, action: input.action, beforeState: input.before, afterState: input.after });
}

export async function getModelSubscriptionPlans(env: Env, modelSlug: string) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({
			planUuid: v2SubscriptionPlans.planUuid, planId: v2SubscriptionPlans.planId, name: v2SubscriptionPlans.name,
			labSlug: v2SubscriptionPlans.labSlug, description: v2SubscriptionPlans.description, link: v2SubscriptionPlans.link,
			otherInfo: v2SubscriptionPlans.otherInfo, createdAt: v2SubscriptionPlans.createdAt, updatedAt: v2SubscriptionPlans.updatedAt,
			modelInfo: v2SubscriptionPlanModels.modelInfo, rateLimit: v2SubscriptionPlanModels.rateLimit,
			modelOtherInfo: v2SubscriptionPlanModels.otherInfo, price: v2SubscriptionPlans.price,
			currency: v2SubscriptionPlans.currency, frequency: v2SubscriptionPlans.frequency,
		}).from(v2SubscriptionPlanModels).innerJoin(v2SubscriptionPlans, eq(v2SubscriptionPlans.planUuid, v2SubscriptionPlanModels.planUuid))
			.where(eq(v2SubscriptionPlanModels.modelSlug, modelSlug.trim().toLowerCase()))
			.orderBy(asc(v2SubscriptionPlans.planId), asc(v2SubscriptionPlans.frequency));
		return rows.map((row) => ({ plan_uuid: row.planUuid, plan_id: row.planId, name: row.name, lab_slug: row.labSlug, description: row.description, link: row.link, other_info: row.otherInfo, created_at: row.createdAt, updated_at: row.updatedAt, model_info: row.modelInfo, rate_limit: row.rateLimit, model_other_info: row.modelOtherInfo, price: row.price, currency: row.currency, frequency: row.frequency }));
	} finally { await client.end({ timeout: 1 }); }
}

export async function mutateAdminCatalogue(env: Env, input: { actorUserId: string; resource: CatalogueResource; action: CatalogueAction; resourceId: string; payload: JsonObject }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		await assertAdmin(tx, input.actorUserId);
		const now = new Date().toISOString();
		let before: unknown = null;
		let after: unknown = null;

		if (input.resource === "organisations") {
			await tx.execute(sql`select lab_slug from ${v2Labs} where lab_slug=${input.resourceId} for update`);
			[before] = await tx.select().from(v2Labs).where(eq(v2Labs.labSlug, input.resourceId)).limit(1);
			if (input.action === "delete") await tx.delete(v2Labs).where(eq(v2Labs.labSlug, input.resourceId));
			else {
				const metadata = { ...object(before && (before as any).metadata), colour: input.payload.colour ?? undefined, source: "admin" };
				await tx.insert(v2Labs).values({ labSlug: input.resourceId, name: text(input.payload.name), countryCode: nullableText(input.payload.country_code) ?? "xx", description: nullableText(input.payload.description), status: "active", metadata, updatedAt: now })
					.onConflictDoUpdate({ target: v2Labs.labSlug, set: { name: text(input.payload.name), countryCode: nullableText(input.payload.country_code) ?? "xx", description: nullableText(input.payload.description), metadata, updatedAt: now } });
				await tx.delete(v2LabLinks).where(eq(v2LabLinks.labSlug, input.resourceId));
				const links = Array.isArray(input.payload.social_links) ? input.payload.social_links.map(object) : [];
				if (links.length) await tx.insert(v2LabLinks).values(links.map((link) => ({ labSlug: input.resourceId, platform: text(link.platform), url: text(link.url) })));
			}
			[after] = await tx.select().from(v2Labs).where(eq(v2Labs.labSlug, input.resourceId)).limit(1);
		} else if (input.resource === "providers") {
			await tx.execute(sql`select provider_slug from ${v2Providers} where provider_slug=${input.resourceId} for update`);
			[before] = await tx.select().from(v2Providers).where(eq(v2Providers.providerSlug, input.resourceId)).limit(1);
			if (input.action === "delete") await tx.delete(v2Providers).where(eq(v2Providers.providerSlug, input.resourceId));
			else {
				const metadata = { ...object(before && (before as any).metadata), description: input.payload.description ?? undefined, prompt_training_policy: input.payload.prompt_training_policy ?? undefined, prompt_training_notes: input.payload.prompt_training_notes ?? undefined, prompt_training_source_url: input.payload.prompt_training_source_url ?? undefined, data_policy_tier: input.payload.data_policy_tier ?? undefined, data_policy_confidence: input.payload.data_policy_confidence ?? undefined, data_policy_contract_mode: input.payload.data_policy_contract_mode ?? undefined, data_policy_contract_notes: input.payload.data_policy_contract_notes ?? undefined, source: "admin" };
				const values = { name: text(input.payload.api_provider_name), status: nullableText(input.payload.status)?.toLowerCase() ?? "active", countryCode: nullableText(input.payload.country_code) ?? "xx", baseUrl: nullableText(input.payload.link), metadata, updatedAt: now };
				await tx.insert(v2Providers).values({ providerSlug: input.resourceId, ...values }).onConflictDoUpdate({ target: v2Providers.providerSlug, set: values });
			}
			[after] = await tx.select().from(v2Providers).where(eq(v2Providers.providerSlug, input.resourceId)).limit(1);
		} else if (input.resource === "benchmarks") {
			await tx.execute(sql`select benchmark_id from ${v2Benchmarks} where benchmark_id=${input.resourceId} for update`);
			[before] = await tx.select().from(v2Benchmarks).where(eq(v2Benchmarks.benchmarkId, input.resourceId)).limit(1);
			if (input.action === "delete") await tx.delete(v2Benchmarks).where(eq(v2Benchmarks.benchmarkId, input.resourceId));
			else {
				const values = { name: text(input.payload.name), category: nullableText(input.payload.category), link: nullableText(input.payload.link), ascendingOrder: Boolean(input.payload.ascending_order), updatedAt: now };
				await tx.insert(v2Benchmarks).values({ benchmarkId: input.resourceId, ...values }).onConflictDoUpdate({ target: v2Benchmarks.benchmarkId, set: values });
			}
			[after] = await tx.select().from(v2Benchmarks).where(eq(v2Benchmarks.benchmarkId, input.resourceId)).limit(1);
		} else if (input.resource === "subscription-plans") {
			await tx.execute(sql`select plan_uuid from ${v2SubscriptionPlans} where plan_uuid=${input.resourceId}::uuid for update`);
			[before] = await tx.select().from(v2SubscriptionPlans).where(eq(v2SubscriptionPlans.planUuid, input.resourceId)).limit(1);
			if (input.action === "delete") await tx.delete(v2SubscriptionPlans).where(eq(v2SubscriptionPlans.planUuid, input.resourceId));
			else {
				const otherInfo = { ...object(before && (before as any).otherInfo), ...object(input.payload.other_info), source: "admin" };
				const values = { planId: text(input.payload.plan_id), name: text(input.payload.name), labSlug: nullableText(input.payload.organisation_id), description: nullableText(input.payload.description), frequency: nullableText(input.payload.frequency), price: input.payload.price == null ? null : String(input.payload.price), currency: nullableText(input.payload.currency), link: nullableText(input.payload.link), otherInfo, updatedAt: now };
				await tx.insert(v2SubscriptionPlans).values({ planUuid: input.resourceId, ...values }).onConflictDoUpdate({ target: v2SubscriptionPlans.planUuid, set: values });
			}
			[after] = await tx.select().from(v2SubscriptionPlans).where(eq(v2SubscriptionPlans.planUuid, input.resourceId)).limit(1);
		} else {
			await tx.execute(sql`select model_slug from ${v2Models} where model_slug=${input.resourceId} for update`);
			[before] = await tx.select().from(v2Models).where(eq(v2Models.modelSlug, input.resourceId)).limit(1);
			if (input.action === "delete") await tx.delete(v2Models).where(eq(v2Models.modelSlug, input.resourceId));
			else {
				const old = before as typeof v2Models.$inferSelect | undefined;
				const metadata = { ...object(old?.metadata), ...(Object.hasOwn(input.payload, "license") ? { license: input.payload.license } : {}), ...(Object.hasOwn(input.payload, "previousModelId") ? { previous_model_id: input.payload.previousModelId } : {}), source: "admin" };
				const values = { labSlug: Object.hasOwn(input.payload, "organisationId") ? text(input.payload.organisationId) : old?.labSlug ?? "", name: Object.hasOwn(input.payload, "name") ? text(input.payload.name) : old?.name ?? "", status: Object.hasOwn(input.payload, "status") ? (nullableText(input.payload.status)?.toLowerCase() ?? "active") : old?.status ?? "active", hidden: Object.hasOwn(input.payload, "hidden") ? Boolean(input.payload.hidden) : old?.hidden ?? false, inputModalities: Object.hasOwn(input.payload, "inputTypes") ? stringList(input.payload.inputTypes) : old?.inputModalities ?? [], outputModalities: Object.hasOwn(input.payload, "outputTypes") ? stringList(input.payload.outputTypes) : old?.outputModalities ?? [], familySlug: Object.hasOwn(input.payload, "familyId") ? nullableText(input.payload.familyId) : old?.familySlug ?? null, announcedAt: Object.hasOwn(input.payload, "announcementDate") ? dateText(input.payload.announcementDate) : old?.announcedAt ?? null, releasedAt: Object.hasOwn(input.payload, "releaseDate") ? dateText(input.payload.releaseDate) : old?.releasedAt ?? null, deprecatedAt: Object.hasOwn(input.payload, "deprecationDate") ? dateText(input.payload.deprecationDate) : old?.deprecatedAt ?? null, retiredAt: Object.hasOwn(input.payload, "retirementDate") ? dateText(input.payload.retirementDate) : old?.retiredAt ?? null, metadata, updatedAt: now };
				await tx.insert(v2Models).values({ modelSlug: input.resourceId, ...values }).onConflictDoUpdate({ target: v2Models.modelSlug, set: values });
			}
			[after] = await tx.select().from(v2Models).where(eq(v2Models.modelSlug, input.resourceId)).limit(1);
		}

		await audit(tx, { actorUserId: input.actorUserId, resourceType: input.resource, resourceId: input.resourceId, action: input.action, before: before ?? null, after: after ?? null });
		await recordOverride(tx, { actorUserId: input.actorUserId, sourceType: input.resource, sourceKey: input.resourceId, disposition: input.action === "delete" ? "suppressed" : "database_managed", resourceId: input.resourceId });
		return { before: before ?? null, after: after ?? null };
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function mutateAdminProviderRoute(env: Env, input: { actorUserId: string; modelSlug: string; route: JsonObject }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		await assertAdmin(tx, input.actorUserId);
		const providerSlug = nullableText(input.route.provider_slug);
		const providerModelSlug = nullableText(input.route.provider_model_slug);
		if (!providerSlug) throw new Error("provider not found");
		if (!providerModelSlug) throw new Error("provider_model_slug is required");
		const [[model], [provider]] = await Promise.all([tx.select({ id: v2Models.modelSlug }).from(v2Models).where(eq(v2Models.modelSlug, input.modelSlug)).limit(1), tx.select({ id: v2Providers.providerSlug }).from(v2Providers).where(eq(v2Providers.providerSlug, providerSlug)).limit(1)]);
		if (!model) throw new Error("model not found");
		if (!provider) throw new Error("provider not found");
		const id = nullableText(input.route.provider_model_id) ?? `${providerSlug}:${input.modelSlug}:${providerModelSlug}`;
		await tx.execute(sql`select provider_model_id from ${v2ModelProviderRoutes} where provider_model_id=${id} for update`);
		const [before] = await tx.select().from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.providerModelId, id)).limit(1);
		const metadata = { ...object(before?.metadata), source: "admin" };
		const values = { modelSlug: input.modelSlug, providerSlug, providerModelSlug, status: nullableText(input.route.status) ?? "active", routingEnabled: Boolean(input.route.routing_enabled), inputModalities: stringList(input.route.input_modalities), outputModalities: stringList(input.route.output_modalities), regions: stringList(input.route.regions), contextLength: input.route.context_length == null ? null : Number(input.route.context_length), maxOutputTokens: input.route.max_output_tokens == null ? null : Number(input.route.max_output_tokens), effectiveFrom: dateText(input.route.effective_from), effectiveTo: dateText(input.route.effective_to), metadata, updatedAt: new Date().toISOString() };
		await tx.insert(v2ModelProviderRoutes).values({ providerModelId: id, ...values }).onConflictDoUpdate({ target: v2ModelProviderRoutes.providerModelId, set: values });
		const [after] = await tx.select().from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.providerModelId, id)).limit(1);
		await audit(tx, { actorUserId: input.actorUserId, resourceType: "provider_route", resourceId: id, action: before ? "update" : "create", before: before ?? null, after: after ?? null });
		await recordOverride(tx, { actorUserId: input.actorUserId, sourceType: "provider_route", sourceKey: id, disposition: "database_managed", resourceId: id });
		return after;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function mutateAdminPricingSku(env: Env, input: { actorUserId: string; modelSlug: string; action: "save" | "delete"; sku: JsonObject }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		await assertAdmin(tx, input.actorUserId);
		let skuId = nullableText(input.sku.sku_id);
		let existing = skuId ? (await tx.select().from(v2PricingSkus).where(eq(v2PricingSkus.skuId, skuId)).limit(1))[0] : undefined;
		if (!skuId && input.action === "save") {
			const providerModelId = text(input.sku.provider_model_id).trim();
			[existing] = await tx.select().from(v2PricingSkus).where(and(eq(v2PricingSkus.providerModelId, providerModelId), eq(v2PricingSkus.skuCode, text(input.sku.sku_code).trim().toLowerCase()), eq(v2PricingSkus.version, Number(input.sku.version ?? 1)))).limit(1);
			skuId = existing?.skuId ?? crypto.randomUUID();
		}
		if (!skuId) throw new Error("pricing SKU not found");
		await tx.execute(sql`select sku_id from ${v2PricingSkus} where sku_id=${skuId}::uuid for update`);
		if (skuId && !existing) [existing] = await tx.select().from(v2PricingSkus).where(eq(v2PricingSkus.skuId, skuId)).limit(1);
		const oldMeters = existing ? await tx.select().from(v2PricingSkuMeters).where(eq(v2PricingSkuMeters.skuId, skuId)).orderBy(asc(v2PricingSkuMeters.meterOrder), asc(v2PricingSkuMeters.meterKey)) : [];
		const before = existing ? { sku: existing, meters: oldMeters } : null;
		if (existing) {
			const [route] = await tx.select({ modelSlug: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.providerModelId, existing.providerModelId)).limit(1);
			if (route?.modelSlug !== input.modelSlug) throw new Error("pricing SKU does not belong to the requested model");
		}
		if (input.action === "delete") {
			if (!existing) throw new Error("pricing SKU not found");
			await tx.delete(v2PricingSkus).where(eq(v2PricingSkus.skuId, skuId));
			await audit(tx, { actorUserId: input.actorUserId, resourceType: "pricing_sku", resourceId: skuId, action: "delete", before, after: null });
			const sourceKey = nullableText(object(existing.metadata).source_key);
			if (sourceKey) await recordOverride(tx, { actorUserId: input.actorUserId, sourceType: "pricing_rule", sourceKey, disposition: "suppressed", resourceId: skuId });
			return { deleted: true, sku_id: skuId };
		}
		const providerModelId = text(input.sku.provider_model_id).trim();
		const [route] = await tx.select({ modelSlug: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.providerModelId, providerModelId)).limit(1);
		if (route?.modelSlug !== input.modelSlug) throw new Error("provider route does not belong to the requested model");
		const meters = Array.isArray(input.sku.meters) ? input.sku.meters.map(object) : [];
		if (!meters.length) throw new Error("at least one pricing meter is required");
		const now = new Date().toISOString();
		const metadata = { ...object(input.sku.metadata), source: "admin", authored_by: input.actorUserId, authored_at: now };
		const values = { providerModelId, skuCode: text(input.sku.sku_code).trim().toLowerCase(), version: Number(input.sku.version ?? 1), operation: nullableText(input.sku.operation) ?? "inference", status: nullableText(input.sku.status) ?? "active", region: nullableText(input.sku.region), serviceTierSlug: nullableText(input.sku.service_tier_slug) ?? "standard", displayName: text(input.sku.display_name).trim(), description: nullableText(input.sku.description), currency: (nullableText(input.sku.currency) ?? "USD").toUpperCase(), effectiveFrom: nullableText(input.sku.effective_from) ?? now, effectiveTo: dateText(input.sku.effective_to), metadata, updatedAt: now };
		await tx.insert(v2PricingSkus).values({ skuId, ...values }).onConflictDoUpdate({ target: v2PricingSkus.skuId, set: values });
		await tx.delete(v2PricingSkuMeters).where(eq(v2PricingSkuMeters.skuId, skuId));
		await tx.insert(v2PricingSkuMeters).values(meters.map((meter) => ({ skuId, meterKey: text(meter.meter_key).trim().toLowerCase(), modality: text(meter.modality).trim().toLowerCase(), direction: nullableText(meter.direction)?.toLowerCase() ?? null, unit: text(meter.unit).trim().toLowerCase(), unitQuantity: String(meter.unit_quantity), priceNanos: String(meter.price_nanos), displayLabel: text(meter.display_label).trim(), displayUnit: text(meter.display_unit).trim(), billable: meter.billable == null ? true : Boolean(meter.billable), meterOrder: Number(meter.meter_order ?? 100), metadata: { ...object(meter.metadata), source: "admin" } })));
		const [saved] = await tx.select().from(v2PricingSkus).where(eq(v2PricingSkus.skuId, skuId)).limit(1);
		const savedMeters = await tx.select().from(v2PricingSkuMeters).where(eq(v2PricingSkuMeters.skuId, skuId)).orderBy(asc(v2PricingSkuMeters.meterOrder), asc(v2PricingSkuMeters.meterKey));
		const after = { sku: saved, meters: savedMeters };
		await audit(tx, { actorUserId: input.actorUserId, resourceType: "pricing_sku", resourceId: skuId, action: before ? "update" : "create", before, after });
		const sourceKey = nullableText(object(input.sku.metadata).source_key);
		if (sourceKey) await recordOverride(tx, { actorUserId: input.actorUserId, sourceType: "pricing_rule", sourceKey, disposition: "database_managed", resourceId: skuId });
		return after;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function mutateAdminModelGraph(env: Env, input: { actorUserId: string; modelSlug: string; payload: JsonObject }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		await assertAdmin(tx, input.actorUserId);
		await tx.execute(sql`select model_slug from ${v2Models} where model_slug=${input.modelSlug} for update`);
		const [before] = await tx.select().from(v2Models).where(eq(v2Models.modelSlug, input.modelSlug)).limit(1);
		if (!before) throw new Error("model not found");
		const now = new Date().toISOString();
		const p = input.payload;
		const metadata = { ...object(before.metadata), ...(Object.hasOwn(p, "license") ? { license: p.license } : {}), ...(Object.hasOwn(p, "previous_model_id") ? { previous_model_id: p.previous_model_id } : {}), source: "admin" };
		await tx.update(v2Models).set({ name: Object.hasOwn(p, "name") ? text(p.name) : before.name, labSlug: Object.hasOwn(p, "organisation_id") ? text(p.organisation_id) : before.labSlug, status: Object.hasOwn(p, "status") && p.status != null ? text(p.status).toLowerCase() : before.status, hidden: Object.hasOwn(p, "hidden") ? Boolean(p.hidden) : before.hidden, familySlug: Object.hasOwn(p, "family_id") ? nullableText(p.family_id) : before.familySlug, inputModalities: Object.hasOwn(p, "input_types") ? stringList(p.input_types) : before.inputModalities, outputModalities: Object.hasOwn(p, "output_types") ? stringList(p.output_types) : before.outputModalities, announcedAt: Object.hasOwn(p, "announcement_date") ? dateText(p.announcement_date) : before.announcedAt, releasedAt: Object.hasOwn(p, "release_date") ? dateText(p.release_date) : before.releasedAt, deprecatedAt: Object.hasOwn(p, "deprecation_date") ? dateText(p.deprecation_date) : before.deprecatedAt, retiredAt: Object.hasOwn(p, "retirement_date") ? dateText(p.retirement_date) : before.retiredAt, metadata, updatedAt: now }).where(eq(v2Models.modelSlug, input.modelSlug));

		if (Object.hasOwn(p, "family")) {
			const family = object(p.family); const familySlug = text(family.family_id);
			const familyMetadata = { description: family.family_description ?? undefined, source: "admin" };
			await tx.insert(v2ModelFamilies).values({ familySlug, labSlug: text(p.organisation_id ?? before.labSlug), name: text(family.family_name), metadata: familyMetadata, updatedAt: now }).onConflictDoUpdate({ target: v2ModelFamilies.familySlug, set: { name: text(family.family_name), metadata: familyMetadata, updatedAt: now } });
			await tx.update(v2Models).set({ familySlug, updatedAt: now }).where(eq(v2Models.modelSlug, input.modelSlug));
		}
		if (Object.hasOwn(p, "model_details")) { await tx.delete(v2ModelDetails).where(eq(v2ModelDetails.modelSlug, input.modelSlug)); const rows = Array.isArray(p.model_details) ? p.model_details.map(object) : []; if (rows.length) await tx.insert(v2ModelDetails).values(rows.map((row, index) => ({ modelSlug: input.modelSlug, detailName: text(row.detail_name), detailValue: row.detail_value ?? null, detailOrder: 101 + index }))); }
		if (Object.hasOwn(p, "links")) { await tx.delete(v2ModelLinks).where(eq(v2ModelLinks.modelSlug, input.modelSlug)); const rows = Array.isArray(p.links) ? p.links.map(object) : []; if (rows.length) await tx.insert(v2ModelLinks).values(rows.map((row) => ({ modelSlug: input.modelSlug, linkKind: nullableText(row.kind) ?? text(row.platform), title: nullableText(row.title) ?? text(row.platform), url: text(row.url), metadata: { source: "admin" } }))); }
		if (Object.hasOwn(p, "benchmark_results")) { await tx.delete(v2BenchmarkResults).where(eq(v2BenchmarkResults.modelSlug, input.modelSlug)); const rows = Array.isArray(p.benchmark_results) ? p.benchmark_results.map(object) : []; if (rows.length) await tx.insert(v2BenchmarkResults).values(rows.map((row) => { const score = nullableText(row.score); return { modelSlug: input.modelSlug, benchmarkId: text(row.benchmark_id), score, scoreNumeric: score && /^[-+]?[0-9]*\.?[0-9]+$/.test(score) ? score : null, isSelfReported: Boolean(row.is_self_reported), otherInfo: nullableText(row.other_info), sourceLink: nullableText(row.source_link), variant: nullableText(row.variant), updatedAt: now }; })); }
		if (Object.hasOwn(p, "subscription_plan_models")) { await tx.delete(v2SubscriptionPlanModels).where(eq(v2SubscriptionPlanModels.modelSlug, input.modelSlug)); const rows = Array.isArray(p.subscription_plan_models) ? p.subscription_plan_models.map(object) : []; if (rows.length) await tx.insert(v2SubscriptionPlanModels).values(rows.map((row) => ({ planUuid: text(row.plan_uuid), modelSlug: input.modelSlug, modelInfo: object(row.model_info), rateLimit: object(row.rate_limit), otherInfo: object(row.other_info) }))); }

		if (Object.hasOwn(p, "provider_models")) {
			const rows = Array.isArray(p.provider_models) ? p.provider_models.map(object) : [];
			const deduped = new Map<string, JsonObject>();
			for (const row of rows) { const providerSlug = text(row.provider_id); const providerModelSlug = nullableText(row.provider_model_slug) ?? text(row.api_model_id); const rawId = text(row.id); deduped.set(!rawId || rawId.startsWith("new-") ? `${providerSlug}:${input.modelSlug}:${providerModelSlug}` : rawId, row); }
			for (const [id, row] of deduped) {
				const old = (await tx.select().from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.providerModelId, id)).limit(1))[0];
				const providerSlug = text(row.provider_id); const providerModelSlug = nullableText(row.provider_model_slug) ?? text(row.api_model_id);
				const routeMetadata = { ...object(old?.metadata), prompt_training_policy_override: row.prompt_training_policy_override ?? undefined, prompt_training_override_notes: row.prompt_training_override_notes ?? undefined, prompt_training_override_source_url: row.prompt_training_override_source_url ?? undefined, quantization_scheme: row.quantization_scheme ?? undefined, source: "admin" };
				const values = { modelSlug: input.modelSlug, providerSlug, providerModelSlug, status: "active", routingEnabled: Boolean(row.is_active_gateway), inputModalities: stringList(row.input_modalities), outputModalities: stringList(row.output_modalities), contextLength: row.context_length == null || row.context_length === "" ? null : Number(row.context_length), maxOutputTokens: row.max_output_tokens == null || row.max_output_tokens === "" ? null : Number(row.max_output_tokens), effectiveFrom: dateText(row.effective_from), effectiveTo: dateText(row.effective_to), metadata: routeMetadata, updatedAt: now };
				await tx.insert(v2ModelProviderRoutes).values({ providerModelId: id, ...values }).onConflictDoUpdate({ target: v2ModelProviderRoutes.providerModelId, set: values });
			}
			const keep = [...deduped.keys()];
			await tx.delete(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.modelSlug, input.modelSlug), sql`${v2ModelProviderRoutes.metadata}->>'source' in ('json','models.dev')`, keep.length ? sql`${v2ModelProviderRoutes.providerModelId} not in (${sql.join(keep.map((id) => sql`${id}`), sql`,`)})` : sql`true`));
		}
		if (Object.hasOwn(p, "provider_capabilities")) {
			const rows = Array.isArray(p.provider_capabilities) ? p.provider_capabilities.map(object) : [];
			const routes = await tx.select().from(v2ModelProviderRoutes).where(eq(v2ModelProviderRoutes.modelSlug, input.modelSlug));
			const routeByKey = new Map(routes.map((route) => [`${route.providerSlug}:${route.providerModelSlug}`, route]));
			for (const row of rows) if (!routeByKey.has(`${text(row.provider_id)}:${nullableText(row.provider_model_slug) ?? text(row.api_model_id)}`)) throw new Error("provider capability does not match a model route");
			if (routes.length) await tx.delete(v2RouteCapabilities).where(inArray(v2RouteCapabilities.providerModelId, routes.map((route) => route.providerModelId)));
			if (rows.length) await tx.insert(v2RouteCapabilities).values(rows.map((row) => { const route = routeByKey.get(`${text(row.provider_id)}:${nullableText(row.provider_model_slug) ?? text(row.api_model_id)}`)!; const editorStatus = nullableText(row.status) ?? "active"; return { providerModelId: route.providerModelId, capabilityId: text(row.capability_id), status: editorStatus.startsWith("deranked_") ? "degraded" : editorStatus, params: object(row.params), effectiveFrom: dateText(row.effective_from), effectiveTo: dateText(row.effective_to), metadata: { editor_status: editorStatus, source: "admin" }, updatedAt: now }; }));
		}
		const [after] = await tx.select().from(v2Models).where(eq(v2Models.modelSlug, input.modelSlug)).limit(1);
		await audit(tx, { actorUserId: input.actorUserId, resourceType: "model_graph", resourceId: input.modelSlug, action: "save", before, after });
		await recordOverride(tx, { actorUserId: input.actorUserId, sourceType: "model", sourceKey: input.modelSlug, disposition: "database_managed", resourceId: input.modelSlug });
		return { model: after };
	}); } finally { await client.end({ timeout: 1 }); }
}
