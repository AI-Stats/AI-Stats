import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { listManagedChatKeyIds, loadAccountPrivacy, saveAccountPrivacy, validatePrivacyRoutes } from "@/repositories/account-privacy";

type PolicyPayload = {
	privacyEnablePaidMayTrain: boolean;
	privacyEnableFreeMayTrain: boolean;
	privacyEnableInputOutputLogging: boolean;
	privacyZdrOnly: boolean;
	providerRestrictionMode: "none" | "allowlist" | "blocklist";
	providerRestrictionProviderIds: string[];
	modelRestrictionMode: "none" | "allowlist" | "blocklist";
	modelRestrictionModelIds: string[];
};

const DEFAULT_POLICY: PolicyPayload = {
	privacyEnablePaidMayTrain: true,
	privacyEnableFreeMayTrain: true,
	privacyEnableInputOutputLogging: true,
	privacyZdrOnly: false,
	providerRestrictionMode: "none",
	providerRestrictionProviderIds: [],
	modelRestrictionMode: "none",
	modelRestrictionModelIds: [],
};
const CHAT_MANAGED_KEY_NAME = "__chat_route_managed_key__";

function mode(value: unknown): "none" | "allowlist" | "blocklist" {
	return value === "allowlist" || value === "blocklist" ? value : "none";
}

function strings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].sort();
}

function policyFromRow(row: any): PolicyPayload {
	if (!row) return DEFAULT_POLICY;
	return {
		privacyEnablePaidMayTrain: (row.privacyEnablePaidMayTrain ?? row.privacy_enable_paid_may_train) !== false,
		privacyEnableFreeMayTrain: (row.privacyEnableFreeMayTrain ?? row.privacy_enable_free_may_train) !== false,
		privacyEnableInputOutputLogging: (row.privacyEnableInputOutputLogging ?? row.privacy_enable_input_output_logging) !== false,
		privacyZdrOnly: (row.privacyZdrOnly ?? row.privacy_zdr_only) === true,
		providerRestrictionMode: mode(row.providerRestrictionMode ?? row.provider_restriction_mode),
		providerRestrictionProviderIds: strings(row.providerRestrictionProviderIds ?? row.provider_restriction_provider_ids),
		modelRestrictionMode: mode(row.modelRestrictionMode ?? row.model_restriction_mode),
		modelRestrictionModelIds: strings(row.modelRestrictionModelIds ?? row.model_restriction_model_ids),
	};
}

async function invalidateKey(env: Env, keyId: string) {
	if (!env.PHASEO_CONTROL_KEY || !env.PHASEO_CONTROL_SECRET) throw new Error("gateway_invalidation_unavailable");
	const response = await fetch(`${(env.GATEWAY_API_ORIGIN ?? "http://localhost:8787").replace(/\/$/, "")}/v1/keys/${encodeURIComponent(keyId)}/invalidate`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.PHASEO_CONTROL_KEY}`,
			"x-control-secret": env.PHASEO_CONTROL_SECRET,
		},
	});
	if (!response.ok) throw new Error("gateway_invalidation_failed");
}

export const accountSettingsAccountPrivacyRouter = new Hono<{ Bindings: Env }>();

accountSettingsAccountPrivacyRouter.get("/account/privacy", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ signedIn: false, policy: DEFAULT_POLICY, providers: [], models: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	try {
		const source = await loadAccountPrivacy(c.env, user.id, c.req.query("compact") === "1");
		const policy = policyFromRow(source.policy);
		if (c.req.query("compact") === "1") return c.json({ signedIn: true, policy, providers: [], models: [] }, 200, PRIVATE_NO_STORE_HEADERS);
		const routeProviderIds = new Set(source.routes.map((row) => row.provider_slug));
		const routableModelIds = new Set(source.routes.map((row) => row.model_slug));
		policy.providerRestrictionProviderIds = policy.providerRestrictionProviderIds.filter((id) => routeProviderIds.has(id));
		policy.modelRestrictionModelIds = policy.modelRestrictionModelIds.filter((id) => routableModelIds.has(id));
		const providerIdsByModel = new Map<string, Set<string>>();
		for (const route of source.routes) { const ids = providerIdsByModel.get(route.model_slug) ?? new Set<string>(); ids.add(route.provider_slug); providerIdsByModel.set(route.model_slug, ids); }
		return c.json({ signedIn: true, policy, providers: source.providers.filter((provider) => routeProviderIds.has(provider.id)), models: source.models.map((model) => ({ id: model.id, name: model.name ?? model.id, organisationId: model.organisationId, organisationName: model.organisationName ?? "Other", providerIds: [...(providerIdsByModel.get(model.id) ?? [])] })) }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsAccountPrivacyRouter.put("/account/privacy", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const requestedProviders = strings(body.providerRestrictionProviderIds);
	const requestedModels = strings(body.modelRestrictionModelIds);
	const { providerIds: validProviderIds, modelIds: validModelIds } = await validatePrivacyRoutes(c.env, requestedProviders, requestedModels);
	if (requestedProviders.some((id) => !validProviderIds.has(id)) || requestedModels.some((id) => !validModelIds.has(id))) {
		return c.json({ error: "invalid_route_restriction" }, 400, PRIVATE_NO_STORE_HEADERS);
	}
	const policy: PolicyPayload = {
		privacyEnablePaidMayTrain: body.privacyEnablePaidMayTrain !== false,
		privacyEnableFreeMayTrain: body.privacyEnableFreeMayTrain !== false,
		privacyEnableInputOutputLogging: body.privacyEnableInputOutputLogging !== false,
		privacyZdrOnly: body.privacyZdrOnly === true,
		providerRestrictionMode: mode(body.providerRestrictionMode),
		providerRestrictionProviderIds: requestedProviders,
		modelRestrictionMode: mode(body.modelRestrictionMode),
		modelRestrictionModelIds: requestedModels,
	};
	try { await saveAccountPrivacy(c.env, user.id, policy); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	let keyIds: string[];
	try { keyIds = await listManagedChatKeyIds(c.env, user.id, CHAT_MANAGED_KEY_NAME); } catch (error) {
		console.error("account_privacy_key_lookup_failed", { userId: user.id, error });
		return c.json({ ok: true, policy, cacheInvalidationPending: true }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const invalidations = await Promise.allSettled(keyIds.map((keyId) => invalidateKey(c.env, keyId)));
	const failedKeyIds = invalidations.flatMap((result, index) => result.status === "rejected" ? [keyIds[index]] : []);
	if (failedKeyIds.length) console.error("account_privacy_cache_invalidation_failed", { userId: user.id, failedKeyIds });
	return c.json({ ok: true, policy, cacheInvalidationPending: failedKeyIds.length > 0 }, 200, PRIVATE_NO_STORE_HEADERS);
});
