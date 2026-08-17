import { accountGuardrailSettings, keys, v2Labs, v2ModelProviderRoutes, v2Models, v2Providers } from "@phaseo/db/schema";
import { and, asc, eq, inArray, ne } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

const activeRoute = and(eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]));

export async function loadAccountPrivacy(env: Env, userId: string, compact: boolean) {
	const { db, client } = createDatabase(env);
	try {
		const [policy] = await db.select().from(accountGuardrailSettings).where(eq(accountGuardrailSettings.userId, userId)).limit(1);
		if (compact) return { policy: policy ?? null, providers: [], routes: [], models: [] };
		const [providers, routes] = await Promise.all([
			db.select({ id: v2Providers.providerSlug, name: v2Providers.name, provider_family_id: v2Providers.providerFamilySlug, offer_label: v2Providers.offerLabel, offer_scope: v2Providers.offerScope }).from(v2Providers).where(and(eq(v2Providers.routable, true), eq(v2Providers.routingEnabled, true), inArray(v2Providers.status, ["active", "degraded"]))).orderBy(asc(v2Providers.name)),
			db.select({ model_slug: v2ModelProviderRoutes.modelSlug, provider_slug: v2ModelProviderRoutes.providerSlug }).from(v2ModelProviderRoutes).where(activeRoute),
		]);
		const modelIds = [...new Set(routes.map((row) => row.model_slug))];
		const models = modelIds.length ? await db.select({ id: v2Models.modelSlug, name: v2Models.name, organisationId: v2Models.labSlug, organisationName: v2Labs.name }).from(v2Models).leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(inArray(v2Models.modelSlug, modelIds)).orderBy(asc(v2Models.name)) : [];
		return { policy: policy ?? null, providers, routes, models };
	} finally { await client.end({ timeout: 1 }); }
}

export async function validatePrivacyRoutes(env: Env, providerIds: string[], modelIds: string[]) {
	const { db, client } = createDatabase(env);
	try {
		const [providers, models] = await Promise.all([
			providerIds.length ? db.selectDistinct({ id: v2ModelProviderRoutes.providerSlug }).from(v2ModelProviderRoutes).where(and(activeRoute, inArray(v2ModelProviderRoutes.providerSlug, providerIds))) : [],
			modelIds.length ? db.selectDistinct({ id: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(and(activeRoute, inArray(v2ModelProviderRoutes.modelSlug, modelIds))) : [],
		]);
		return { providerIds: new Set(providers.map((row) => row.id)), modelIds: new Set(models.map((row) => row.id)) };
	} finally { await client.end({ timeout: 1 }); }
}

export async function saveAccountPrivacy(env: Env, userId: string, policy: { privacyEnablePaidMayTrain: boolean; privacyEnableFreeMayTrain: boolean; privacyEnableInputOutputLogging: boolean; privacyZdrOnly: boolean; providerRestrictionMode: string; providerRestrictionProviderIds: string[]; modelRestrictionMode: string; modelRestrictionModelIds: string[] }) {
	const { db, client } = createDatabase(env);
	try { await db.insert(accountGuardrailSettings).values({ userId, ...policy }).onConflictDoUpdate({ target: accountGuardrailSettings.userId, set: { ...policy, updatedAt: new Date().toISOString() } }); }
	finally { await client.end({ timeout: 1 }); }
}

export async function listManagedChatKeyIds(env: Env, userId: string, name: string) {
	const { db, client } = createDatabase(env);
	try { return (await db.select({ id: keys.id }).from(keys).where(and(eq(keys.createdBy, userId), eq(keys.name, name), ne(keys.status, "deleted")))).map((row) => row.id); }
	finally { await client.end({ timeout: 1 }); }
}
