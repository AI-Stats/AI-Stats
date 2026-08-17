import {
	v2Labs,
	v2ModelAliases,
	v2ModelDetails,
	v2ModelProviderRoutes,
	v2Models,
	v2Providers,
	v2RouteCapabilities,
} from "@phaseo/db/schema";
import { and, asc, eq, inArray } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try {
		return await operation(db);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listOrganisations(limit: number, offset: number) {
	return withDatabase(async (db) => {
		const [total, rows] = await Promise.all([
			db.$count(v2Labs),
			db.select({
				organisationId: v2Labs.labSlug,
				name: v2Labs.name,
				countryCode: v2Labs.countryCode,
				description: v2Labs.description,
				metadata: v2Labs.metadata,
			}).from(v2Labs).orderBy(asc(v2Labs.name)).limit(limit).offset(offset),
		]);
		return { total, rows };
	});
}

export async function listProviders(limit: number, offset: number) {
	return withDatabase(async (db) => {
		const [total, rows] = await Promise.all([
			db.$count(v2Providers),
			db.select({
				apiProviderId: v2Providers.providerSlug,
				apiProviderName: v2Providers.name,
				metadata: v2Providers.metadata,
				countryCode: v2Providers.countryCode,
			}).from(v2Providers).orderBy(asc(v2Providers.name)).limit(limit).offset(offset),
		]);
		return { total, rows };
	});
}

function chunks<T>(values: readonly T[], size = 200): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
	return result;
}

export async function loadCatalogueMetadata() {
	return withDatabase(async (db) => {
		const models = await db.select({
			model_id: v2Models.modelSlug,
			base_model_id: v2Models.baseModelSlug,
			variant_kind: v2Models.variantKind,
			previous_model_id: v2Models.previousModelSlug,
			name: v2Models.name,
			description: v2Models.description,
			release_date: v2Models.releasedAt,
			deprecation_date: v2Models.deprecatedAt,
			retirement_date: v2Models.retiredAt,
			status: v2Models.status,
			organisation_id: v2Models.labSlug,
			input_types: v2Models.inputModalities,
			output_types: v2Models.outputModalities,
			organisation_slug: v2Labs.labSlug,
			organisation_name: v2Labs.name,
			organisation_country_code: v2Labs.countryCode,
			organisation_metadata: v2Labs.metadata,
		}).from(v2Models)
			.leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug))
			.where(eq(v2Models.hidden, false));

		const modelIds = models.map((model) => model.model_id);
		if (!modelIds.length) {
			return { models, details: [], routes: [], capabilities: [], aliases: [], providers: [] };
		}

		const details = [] as Array<{
			model_slug: string;
			detail_name: string;
			detail_value: unknown;
		}>;
		const routes = [] as Array<{
			provider_api_model_id: string;
			provider_id: string;
			api_model_id: string;
			model_id: string;
			provider_model_slug: string;
			is_active_gateway: boolean;
			routing_status: string;
			input_modalities: string[];
			output_modalities: string[];
			effective_from: string | null;
			effective_to: string | null;
		}>;
		const aliases = [] as Array<{ alias_slug: string; api_model_id: string }>;

		for (const modelIdChunk of chunks(modelIds)) {
			const [detailRows, routeRows, aliasRows] = await Promise.all([
				db.select({
					model_slug: v2ModelDetails.modelSlug,
					detail_name: v2ModelDetails.detailName,
					detail_value: v2ModelDetails.detailValue,
				}).from(v2ModelDetails).where(inArray(v2ModelDetails.modelSlug, modelIdChunk)),
				db.select({
					provider_api_model_id: v2ModelProviderRoutes.providerModelId,
					provider_id: v2ModelProviderRoutes.providerSlug,
					api_model_id: v2ModelProviderRoutes.modelSlug,
					model_id: v2ModelProviderRoutes.modelSlug,
					provider_model_slug: v2ModelProviderRoutes.providerModelSlug,
					is_active_gateway: v2ModelProviderRoutes.routingEnabled,
					routing_status: v2ModelProviderRoutes.status,
					input_modalities: v2ModelProviderRoutes.inputModalities,
					output_modalities: v2ModelProviderRoutes.outputModalities,
					effective_from: v2ModelProviderRoutes.effectiveFrom,
					effective_to: v2ModelProviderRoutes.effectiveTo,
				}).from(v2ModelProviderRoutes).where(inArray(v2ModelProviderRoutes.modelSlug, modelIdChunk)),
				db.select({
					alias_slug: v2ModelAliases.aliasSlug,
					api_model_id: v2ModelAliases.modelSlug,
				}).from(v2ModelAliases).where(and(
					inArray(v2ModelAliases.modelSlug, modelIdChunk),
					eq(v2ModelAliases.enabled, true),
				)),
			]);
			details.push(...detailRows);
			routes.push(...routeRows);
			aliases.push(...aliasRows);
		}

		const providerModelIds = routes.map((route) => route.provider_api_model_id);
		const providerIds = [...new Set(routes.map((route) => route.provider_id))];
		const capabilities = [] as Array<{
			provider_api_model_id: string;
			capability_id: string;
			status: string;
			params: unknown;
			effective_from: string | null;
			effective_to: string | null;
		}>;
		for (const providerModelIdChunk of chunks(providerModelIds)) {
			capabilities.push(...await db.select({
				provider_api_model_id: v2RouteCapabilities.providerModelId,
				capability_id: v2RouteCapabilities.capabilityId,
				status: v2RouteCapabilities.status,
				params: v2RouteCapabilities.params,
				effective_from: v2RouteCapabilities.effectiveFrom,
				effective_to: v2RouteCapabilities.effectiveTo,
			}).from(v2RouteCapabilities).where(inArray(v2RouteCapabilities.providerModelId, providerModelIdChunk)));
		}

		const providers = [] as Array<{
			api_provider_id: string;
			api_provider_name: string;
			metadata: unknown;
			country_code: string;
			status: string;
			routing_enabled: boolean;
		}>;
		for (const providerIdChunk of chunks(providerIds)) {
			providers.push(...await db.select({
				api_provider_id: v2Providers.providerSlug,
				api_provider_name: v2Providers.name,
				metadata: v2Providers.metadata,
				country_code: v2Providers.countryCode,
				status: v2Providers.status,
				routing_enabled: v2Providers.routingEnabled,
			}).from(v2Providers).where(inArray(v2Providers.providerSlug, providerIdChunk)));
		}

		return { models, details, routes, capabilities, aliases, providers };
	});
}
