import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";

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
		privacyEnablePaidMayTrain: row.privacy_enable_paid_may_train !== false,
		privacyEnableFreeMayTrain: row.privacy_enable_free_may_train !== false,
		privacyEnableInputOutputLogging: row.privacy_enable_input_output_logging !== false,
		privacyZdrOnly: row.privacy_zdr_only === true,
		providerRestrictionMode: mode(row.provider_restriction_mode),
		providerRestrictionProviderIds: strings(row.provider_restriction_provider_ids),
		modelRestrictionMode: mode(row.model_restriction_mode),
		modelRestrictionModelIds: strings(row.model_restriction_model_ids),
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
	const client = getDataClient(c.env);
	if (c.req.query("compact") === "1") {
		const result = await client.from("account_guardrail_settings").select("privacy_enable_paid_may_train,privacy_enable_free_may_train,privacy_enable_input_output_logging,privacy_zdr_only,provider_restriction_mode,provider_restriction_provider_ids,model_restriction_mode,model_restriction_model_ids").eq("user_id", user.id).maybeSingle();
		if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
		return c.json({ signedIn: true, policy: policyFromRow(result.data), providers: [], models: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const [policyResult, providersResult, routesResult] = await Promise.all([
		client.from("account_guardrail_settings").select("privacy_enable_paid_may_train,privacy_enable_free_may_train,privacy_enable_input_output_logging,privacy_zdr_only,provider_restriction_mode,provider_restriction_provider_ids,model_restriction_mode,model_restriction_model_ids").eq("user_id", user.id).maybeSingle(),
		client.from("v2_providers").select("id:provider_slug,name,provider_family_id:provider_family_slug,offer_label,offer_scope").eq("routable", true).eq("routing_enabled", true).in("status", ["active", "degraded"]).order("name"),
		client.from("v2_model_provider_routes").select("model_slug,provider_slug").eq("routing_enabled", true).in("status", ["active", "degraded"]),
	]);
	if (policyResult.error || providersResult.error || routesResult.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const modelIds = [...new Set((routesResult.data ?? []).map((row) => String(row.model_slug ?? "").trim()).filter(Boolean))];
	const routeProviderIds = new Set((routesResult.data ?? []).map((row) => String(row.provider_slug ?? "").trim()).filter(Boolean));
	const modelsResult = modelIds.length
		? await client.from("v2_models").select("id:model_slug,name,organisation:v2_labs(lab_slug,name)").in("model_slug", modelIds).order("name")
		: { data: [], error: null };
	if (modelsResult.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const providerIdsByModel = new Map<string, Set<string>>();
	for (const route of routesResult.data ?? []) {
		const modelId = String(route.model_slug ?? "").trim();
		const providerId = String(route.provider_slug ?? "").trim();
		if (!modelId || !providerId) continue;
		const ids = providerIdsByModel.get(modelId) ?? new Set<string>();
		ids.add(providerId);
		providerIdsByModel.set(modelId, ids);
	}
	const policy = policyFromRow(policyResult.data);
	policy.providerRestrictionProviderIds = policy.providerRestrictionProviderIds.filter((id) => routeProviderIds.has(id));
	const routableModelIds = new Set(modelIds);
	policy.modelRestrictionModelIds = policy.modelRestrictionModelIds.filter((id) => routableModelIds.has(id));
	return c.json({
		signedIn: true,
		policy,
		providers: (providersResult.data ?? []).filter((provider) => routeProviderIds.has(String(provider.id))),
		models: (modelsResult.data ?? []).map((model: any) => ({
			id: model.id,
			name: model.name ?? model.id,
			organisationId: model.organisation?.lab_slug ?? null,
			organisationName: model.organisation?.name ?? "Other",
			providerIds: [...(providerIdsByModel.get(String(model.id)) ?? [])],
		})),
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsAccountPrivacyRouter.put("/account/privacy", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const requestedProviders = strings(body.providerRestrictionProviderIds);
	const requestedModels = strings(body.modelRestrictionModelIds);
	const client = getDataClient(c.env);
	const [providersResult, modelsResult] = await Promise.all([
		requestedProviders.length ? client.from("v2_model_provider_routes").select("provider_slug").in("provider_slug", requestedProviders).eq("routing_enabled", true).in("status", ["active", "degraded"]) : Promise.resolve({ data: [], error: null }),
		requestedModels.length ? client.from("v2_model_provider_routes").select("model_slug").in("model_slug", requestedModels).eq("routing_enabled", true).in("status", ["active", "degraded"]) : Promise.resolve({ data: [], error: null }),
	]);
	if (providersResult.error || modelsResult.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const validProviderIds = new Set((providersResult.data ?? []).map((row) => String(row.provider_slug)));
	const validModelIds = new Set((modelsResult.data ?? []).map((row) => String(row.model_slug)));
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
	const result = await client.from("account_guardrail_settings").upsert({
		user_id: user.id,
		privacy_enable_paid_may_train: policy.privacyEnablePaidMayTrain,
		privacy_enable_free_may_train: policy.privacyEnableFreeMayTrain,
		privacy_enable_input_output_logging: policy.privacyEnableInputOutputLogging,
		privacy_zdr_only: policy.privacyZdrOnly,
		provider_restriction_mode: policy.providerRestrictionMode,
		provider_restriction_provider_ids: policy.providerRestrictionProviderIds,
		model_restriction_mode: policy.modelRestrictionMode,
		model_restriction_model_ids: policy.modelRestrictionModelIds,
		updated_at: new Date().toISOString(),
	}, { onConflict: "user_id" });
	if (result.error) return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	const keys = await client.from("keys").select("id").eq("created_by", user.id).eq("name", CHAT_MANAGED_KEY_NAME).neq("status", "deleted");
	if (keys.error) {
		console.error("account_privacy_key_lookup_failed", { userId: user.id, error: keys.error.message });
		return c.json({ ok: true, policy, cacheInvalidationPending: true }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const keyIds = (keys.data ?? []).map((row) => String(row.id));
	const invalidations = await Promise.allSettled(keyIds.map((keyId) => invalidateKey(c.env, keyId)));
	const failedKeyIds = invalidations.flatMap((result, index) => result.status === "rejected" ? [keyIds[index]] : []);
	if (failedKeyIds.length) console.error("account_privacy_cache_invalidation_failed", { userId: user.id, failedKeyIds });
	return c.json({ ok: true, policy, cacheInvalidationPending: failedKeyIds.length > 0 }, 200, PRIVATE_NO_STORE_HEADERS);
});
