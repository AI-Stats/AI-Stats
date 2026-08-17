import { Hono } from "hono";
import { notifyAccountDeleted } from "@/auth/accountLifecycleDiscord";
import { requireUser } from "@/auth/requireUser";
import { findAccountApp, findAccountApps, listWorkspaceApps, mergeAppHistory, updateAccountApp } from "@/repositories/apps";
import { findUserOAuthAuthorization, listUserOAuthAuthorizations, listWorkspaceOAuthApps, loadOAuthAppDetails, revokeUserOAuthAuthorization } from "@/repositories/oauth-apps";
import { getPreviousMonthSpendCents, getWorkspaceKeyUsage } from "@/repositories/settings-summary";
import { listAccountApiKeys, listManagementKeys } from "@/repositories/settings-keys";
import { loadWorkspaceByokSettings } from "@/repositories/byok";
import { getWorkspaceName, listWorkspaceAccess } from "@/repositories/workspace-access";
import { getAccountObfuscation, getWorkspaceBillingStatus, loadWorkspaceBillingTransactions, loadWorkspaceCreditSettings } from "@/repositories/billing-settings";
import { getAccountProfile, listAccountWorkspaces, saveAccountBetaProfile } from "@/repositories/account-auth";
import { getPrivacyPolicies, loadPrivacySettings } from "@/repositories/guardrails";
import { listBroadcastDestinations } from "@/repositories/broadcast";
import { loadObservabilityDestinationOptions } from "@/repositories/observability-settings";
import { deleteIdentityUser } from "@/data/identity";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { requireAccountWorkspace } from "./context";
import { accountSettingsPolicyRouter } from "./settings-policy";
import { accountSettingsUsageRouter } from "./settings-usage";
import { accountSettingsUsageActionsRouter } from "./settings-usage-actions";
import { accountSettingsTeamsRouter } from "./settings-teams";
import { accountSettingsProfileRouter } from "./settings-profile";
import { accountSettingsProfileAvatarRouter, ownedProfileAvatarKey } from "./settings-profile-avatar";
import { accountSettingsKeysRouter } from "./settings-keys";
import { accountSettingsOAuthRouter } from "./settings-oauth";
import { accountSettingsByokRouter } from "./settings-byok";
import { accountSettingsGuardrailsRouter } from "./settings-guardrails";
import { accountSettingsBroadcastRouter } from "./settings-broadcast";
import { accountSettingsWebhooksRouter } from "./settings-webhooks";
import { accountSettingsDataContributionRouter } from "./settings-data-contribution";
import { callDataContributionGateway } from "./settings-data-contribution";
import { accountSettingsDynamicRoutesRouter } from "./settings-dynamic-routes";
import { accountSettingsAccountPrivacyRouter } from "./settings-account-privacy";
import { purgeWorkerCacheTags } from "@/http/invalidation";

function normalizeBetaFeatures(value: unknown): Record<string, boolean> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, boolean] =>
			typeof entry[1] === "boolean",
		),
	);
}

function providerDisplayName(provider: Record<string, unknown>): string {
	const providerId = String(provider.api_provider_id ?? "").trim();
	let name = String(provider.api_provider_name ?? providerId).trim();
	if (["anthropic-aws", "anthropic-aws-us"].includes(providerId)) {
		name = "Anthropic on AWS";
	}
	const label = String(provider.offer_label ?? "").trim();
	const scope = String(provider.offer_scope ?? "").trim();
	if (!label || scope === "global" || ["anthropic-aws", "anthropic-aws-us"].includes(providerId)) {
		return name;
	}
	if (scope === "regional") {
		const providerWords = new Set(name.toLowerCase().split(/\s+/));
		const regional = label.split(/\s+/).filter((word) =>
			!providerWords.has(word.toLowerCase()),
		).join(" ").trim() || label;
		return `${name} (${regional})`;
	}
	return `${name} ${label}`;
}

const APP_CATEGORIES = new Set([
	"chat", "developer-tools", "research", "productivity", "education",
	"commerce", "media", "finance", "other",
]);
const OBSERVABILITY_DESTINATIONS = new Set([
	"otel_collector", "webhook",
]);

function normalizeAppCategories(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const categories = Array.from(new Set(value.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter((item) => APP_CATEGORIES.has(item))))
		.slice(0, 3);
	return categories.length ? categories.join(",") : null;
}

function isInternalApp(titleValue: unknown, keyValue: unknown): boolean {
	const title = String(titleValue ?? "").trim().toLowerCase();
	if (["phaseo chat", "phaseo playground", "ai stats chat", "ai stats playground"].includes(title)) {
		return true;
	}
	const key = String(keyValue ?? "").trim().toLowerCase();
	return ["phaseo-chat", "phaseo-playground", "ai-stats-chat", "aistats-chat", "ai-stats-playground", "aistats-playground"]
		.some((prefix) => key.startsWith(prefix));
}

export const accountSettingsRouter = new Hono<{ Bindings: Env }>();
accountSettingsRouter.route("/", accountSettingsPolicyRouter);
accountSettingsRouter.route("/", accountSettingsUsageRouter);
accountSettingsRouter.route("/", accountSettingsUsageActionsRouter);
accountSettingsRouter.route("/", accountSettingsTeamsRouter);
accountSettingsRouter.route("/", accountSettingsProfileRouter);
accountSettingsRouter.route("/", accountSettingsProfileAvatarRouter);
accountSettingsRouter.route("/", accountSettingsKeysRouter);
accountSettingsRouter.route("/", accountSettingsOAuthRouter);
accountSettingsRouter.route("/", accountSettingsByokRouter);
accountSettingsRouter.route("/", accountSettingsGuardrailsRouter);
accountSettingsRouter.route("/", accountSettingsBroadcastRouter);
accountSettingsRouter.route("/", accountSettingsWebhooksRouter);
accountSettingsRouter.route("/", accountSettingsDataContributionRouter);
accountSettingsRouter.route("/", accountSettingsDynamicRoutesRouter);
accountSettingsRouter.route("/", accountSettingsAccountPrivacyRouter);

accountSettingsRouter.get("/layout", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({
			isEnterpriseInvoiceMode: false,
			showBroadcast: false,
			signedIn: false,
			workspaceId: null,
			workspaceName: null,
		}, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) {
		return c.json({
			isEnterpriseInvoiceMode: false,
			showBroadcast: false,
			signedIn: true,
			workspaceId: null,
			workspaceName: null,
		}, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const context = await requireAccountWorkspace({
		request: c.req.raw,
		env: c.env,
		workspaceId,
	});
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let workspace;
	try { workspace = await getWorkspaceBillingStatus(c.env, context.workspaceId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({
		isEnterpriseInvoiceMode: false,
		showBroadcast: ["owner", "admin"].includes(context.role.toLowerCase()),
		signedIn: true,
		workspaceId: context.workspaceId,
		workspaceName: workspace?.name ?? null,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/contact-personalization", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ defaultInternalId: "", isAuthenticated: false, tierLabel: "", userEmail: null }, 200, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = c.req.query("workspaceId")?.trim();
	const base = { defaultInternalId: "", isAuthenticated: true, tierLabel: "", userEmail: user.email ?? null };
	if (!workspaceId) return c.json(base, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const [spendResult, workspaceResult] = await Promise.all([
		getPreviousMonthSpendCents(c.env, workspaceId).then((data) => ({ data, error: null })).catch((error) => ({ data: 0, error })),
		getWorkspaceBillingStatus(c.env, workspaceId).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error })),
	]);
	if (spendResult.error || workspaceResult.error) return c.json(base, 200, PRIVATE_NO_STORE_HEADERS);
	const lastMonthUsd = Number(spendResult.data ?? 0) / 100;
	return c.json({ ...base, defaultInternalId: workspaceResult.data?.slug ?? workspaceId, tierLabel: lastMonthUsd >= 10_000 ? "Enterprise" : "Basic" }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/beta", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({
			isAdmin: false,
			profile: { betaOptIn: false, betaFeatures: {} },
			signedIn: false,
		}, 200, PRIVATE_NO_STORE_HEADERS);
	}
	let data;
	try { data = await getAccountProfile(c.env, user.id); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const isAdmin = String(data?.role ?? "").toLowerCase() === "admin";
	const betaFeatures = normalizeBetaFeatures(data?.betaFeatures);
	if (isAdmin) betaFeatures.chat_realtime_voice = true;
	else delete betaFeatures.chat_realtime_voice;
	return c.json({
		profile: {
			betaOptIn: Boolean(data?.betaOptIn) || isAdmin,
			betaFeatures,
		},
		isAdmin,
		signedIn: true,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.put("/beta", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	let account;
	try { account = await getAccountProfile(c.env, user.id); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const body: { beta_features?: unknown } = await c.req.json<{ beta_features?: unknown }>().catch(() => ({}));
	const requested = normalizeBetaFeatures(body.beta_features);
	const isAdmin = String(account?.role ?? "").toLowerCase() === "admin";
	const betaFeatures: Record<string, boolean> = isAdmin && requested.models_catalogue_v2 === true ? { models_catalogue_v2: true } : {};
	if (isAdmin) betaFeatures.chat_realtime_voice = true;
	const profile = { betaOptIn: Object.keys(betaFeatures).length > 0, betaFeatures };
	try { await saveAccountBetaProfile(c.env, user.id, profile); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ ok: true, profile }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/privacy", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) {
		return c.json({
			activeProviderModels: [], initialGlobal: null, providers: [],
			accountPolicy: null,
			policy: {
				privacyEnablePaidMayTrain: true, privacyEnableFreeMayTrain: true,
				privacyEnableInputOutputLogging: true, privacyZdrOnly: false,
				providerRestrictionMode: "none", providerRestrictionProviderIds: [],
				modelRestrictionMode: "none", modelRestrictionModelIds: [],
			},
			models: [],
			teamName: null, workspaceId: null,
			dataContribution: {
				available: false,
				enabled: false, policyVersion: "2026-07-26-v2", consentedAt: null,
				sampleRateBps: 10000, classifierSampleRateBps: 1000, discountBps: 100, contributions30d: 0,
				discountNanos30d: 0, classifiers: [], analytics: [],
			},
		}, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const context = await requireAccountWorkspace({
		request: c.req.raw,
		env: c.env,
		workspaceId,
	});
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let privacy;
	let contributionGatewayResult;
	try {
		[privacy, contributionGatewayResult] = await Promise.all([
			loadPrivacySettings(c.env, { workspaceId, userId: context.user.id }),
			callDataContributionGateway({ env: c.env, request: c.req.raw, workspaceId: context.workspaceId }),
		]);
	} catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const routableProviderIds = new Set(privacy.routes.map((row) => String(row.providerSlug)).filter(Boolean));
	const providerIdsByModel = new Map<string, Set<string>>();
	for (const route of privacy.routes) {
		const modelId = String(route.modelSlug ?? "").trim();
		const providerId = String(route.providerSlug ?? "").trim();
		if (!modelId || !providerId) continue;
		const ids = providerIdsByModel.get(modelId) ?? new Set<string>();
		ids.add(providerId);
		providerIdsByModel.set(modelId, ids);
	}
	const settings = privacy.settings;
	const restrictionMode = (value: unknown) => value === "allowlist" || value === "blocklist" ? value : "none";
	const stringList = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
	const contributionData = contributionGatewayResult.status === 200
		? contributionGatewayResult.payload?.data ?? null
		: null;
	return c.json({
		activeProviderModels: privacy.routes.map((row) => ({
			apiModelId: row.modelSlug,
			internalModelId: row.modelSlug,
			providerId: row.providerSlug,
		})),
		initialGlobal: settings ? {
			privacy_enable_paid_may_train: settings.privacyEnablePaidMayTrain,
			privacy_enable_free_may_train: settings.privacyEnableFreeMayTrain,
			privacy_enable_free_may_publish_prompts: settings.privacyEnableFreeMayPublishPrompts,
			privacy_enable_input_output_logging: settings.privacyEnableInputOutputLogging,
			privacy_zdr_only: settings.privacyZdrOnly,
			io_logging_enabled: settings.ioLoggingEnabled,
			io_logging_retention_days: settings.ioLoggingRetentionDays,
			io_logging_include_provider_payloads: settings.ioLoggingIncludeProviderPayloads,
			provider_restriction_mode: settings.providerRestrictionMode,
			provider_restriction_provider_ids: settings.providerRestrictionProviderIds,
			provider_restriction_enforce_allowed: settings.providerRestrictionEnforceAllowed,
			model_restriction_mode: settings.modelRestrictionMode,
			model_restriction_model_ids: settings.modelRestrictionModelIds,
			response_healing_enabled: settings.responseHealingEnabled,
			response_healing_locked: settings.responseHealingLocked,
			response_healing_mode: settings.responseHealingMode,
		} : null,
		accountPolicy: privacy.account ? {
			privacyEnablePaidMayTrain: privacy.account.privacyEnablePaidMayTrain !== false,
			privacyEnableFreeMayTrain: privacy.account.privacyEnableFreeMayTrain !== false,
			privacyEnableInputOutputLogging: privacy.account.privacyEnableInputOutputLogging !== false,
			privacyZdrOnly: privacy.account.privacyZdrOnly === true,
			providerRestrictionMode: restrictionMode(privacy.account.providerRestrictionMode),
			providerRestrictionProviderIds: stringList(privacy.account.providerRestrictionProviderIds).filter((id) => routableProviderIds.has(id)),
			modelRestrictionMode: restrictionMode(privacy.account.modelRestrictionMode),
			modelRestrictionModelIds: stringList(privacy.account.modelRestrictionModelIds).filter((id) => providerIdsByModel.has(id)),
		} : null,
		policy: {
			privacyEnablePaidMayTrain: settings?.privacyEnablePaidMayTrain !== false,
			privacyEnableFreeMayTrain: settings?.privacyEnableFreeMayTrain !== false,
			privacyEnableInputOutputLogging: settings?.privacyEnableInputOutputLogging !== false,
			privacyZdrOnly: settings?.privacyZdrOnly === true,
			providerRestrictionMode: restrictionMode(settings?.providerRestrictionMode),
			providerRestrictionProviderIds: stringList(settings?.providerRestrictionProviderIds).filter((id) => routableProviderIds.has(id)),
			modelRestrictionMode: restrictionMode(settings?.modelRestrictionMode),
			modelRestrictionModelIds: stringList(settings?.modelRestrictionModelIds).filter((id) => providerIdsByModel.has(id)),
		},
		providers: privacy.providers.filter((provider) => routableProviderIds.has(provider.providerSlug)).map((provider) => ({
			id: provider.providerSlug,
			name: providerDisplayName({ api_provider_id: provider.providerSlug, api_provider_name: provider.name, offer_label: provider.offerLabel, offer_scope: provider.offerScope }),
			provider_family_id: provider.providerFamilySlug ?? null,
			offer_label: provider.offerLabel ?? null,
			offer_scope: provider.offerScope ?? null,
		})),
		models: privacy.models.map(({ model, lab }) => ({
			id: model.modelSlug,
			name: model.name ?? model.modelSlug,
			organisationId: lab?.labSlug ?? model.labSlug ?? null,
			organisationName: lab?.name ?? "Other",
			providerIds: [...(providerIdsByModel.get(model.modelSlug) ?? [])],
		})),
		teamName: privacy.workspace?.name ?? null,
		workspaceId,
		dataContribution: {
			available: contributionData !== null,
			enabled: contributionData?.enabled === true,
			policyVersion: contributionData?.policyVersion ?? "2026-07-26-v2",
			consentedAt: contributionData?.consentedAt ?? null,
			sampleRateBps: Number(contributionData?.sampleRateBps ?? 10000),
			classifierSampleRateBps: Number(contributionData?.classifierSampleRateBps ?? 1000),
			discountBps: Number(contributionData?.discountBps ?? 100),
			contributions30d: Number(contributionData?.last30Days?.contributions ?? 0),
			discountNanos30d: Number(contributionData?.last30Days?.discountNanos ?? 0),
			classifiers: contributionData?.classifiers ?? [],
			analytics: contributionData?.analytics ?? [],
		},
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/workspace/privacy-settings", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json(null, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json(null, 200, PRIVATE_NO_STORE_HEADERS);
	let policies;
	try { policies = await getPrivacyPolicies(c.env, { workspaceId, userId: context.user.id }); }
	catch { return c.json(null, 200, PRIVATE_NO_STORE_HEADERS); }
	const data = policies.workspace;
	if (!data) return c.json(null, 200, PRIVATE_NO_STORE_HEADERS);
	const mode = String(data.providerRestrictionMode ?? "").trim().toLowerCase();
	return c.json({
		isAuthenticated: true,
		privacyEnablePaidMayTrain: Boolean(data.privacyEnablePaidMayTrain ?? true),
		privacyEnableFreeMayTrain: Boolean(data.privacyEnableFreeMayTrain ?? true),
		privacyZdrOnly: Boolean(data.privacyZdrOnly ?? false),
		providerRestrictionMode: ["none", "allowlist", "blocklist"].includes(mode) ? mode : "none",
		providerRestrictionProviderIds: Array.isArray(data.providerRestrictionProviderIds)
			? data.providerRestrictionProviderIds.map((value) => String(value ?? "").trim()).filter(Boolean)
			: [],
		accountProviderRestrictionMode: ["none", "allowlist", "blocklist"].includes(String(policies.account?.providerRestrictionMode))
			? policies.account?.providerRestrictionMode
			: "none",
		accountProviderRestrictionProviderIds: Array.isArray(policies.account?.providerRestrictionProviderIds)
			? policies.account.providerRestrictionProviderIds.map((value) => String(value ?? "").trim()).filter(Boolean)
			: [],
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/account/danger", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	return c.json({ signedIn: Boolean(user) }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.delete("/account", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const { error } = await deleteIdentityUser(c.env, user.id);
	if (error) return c.json({ error: "account_delete_failed" }, 503, PRIVATE_NO_STORE_HEADERS);
	const avatarKey = ownedProfileAvatarKey(c.env, c.req.raw, user.userMetadata.avatar_url, user.id);
	if (avatarKey && c.env.PROFILE_AVATARS_BUCKET) {
		await c.env.PROFILE_AVATARS_BUCKET.delete(avatarKey).catch((avatarError) => {
			console.error("account_avatar_delete_failed", { userId: user.id, error: String(avatarError) });
		});
	}
	c.executionCtx.waitUntil(notifyAccountDeleted(c.env, { id: user.id, email: user.email }).catch((notificationError) => console.error("account_delete_notification_failed", { userId: user.id, error: String(notificationError) })));
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/account/details", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({ hasPassword: false, teams: [], user: null }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	let profile;
	let accountWorkspaces;
	try { [profile, accountWorkspaces] = await Promise.all([getAccountProfile(c.env, user.id), listAccountWorkspaces(c.env, user.id)]); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const cookieOverride = c.req.query("obfuscateInfo");
	const obfuscateInfo = cookieOverride === "1"
		? true
		: cookieOverride === "0"
			? false
			: Boolean(profile?.obfuscateInfo);
	const provider = String(user.appMetadata.provider ?? "").trim();
	const teams = accountWorkspaces.map(({ id, name }) => ({ id, name }));
	return c.json({
		hasPassword: !provider || provider === "email",
		teams,
		user: {
			id: user.id,
			displayName: profile?.displayName ?? null,
			email: user.email,
			defaultWorkspaceId: profile?.defaultWorkspaceId ?? null,
			declaredCountryCode: profile?.declaredCountryCode ?? null,
			countryStorageAvailable: true,
			obfuscateInfo,
			createdAt: profile?.createdAt ?? user.createdAt,
		},
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/account/mfa", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({
			hasPassword: false,
			mfaEnabled: false,
			mfaFactorId: null,
			signedIn: false,
		}, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const factor = user.factors.find((candidate) =>
		candidate.factor_type === "totp" && candidate.status === "verified",
	);
	const provider = String(user.appMetadata.provider ?? "").trim();
	return c.json({
		hasPassword: !provider || provider === "email",
		mfaEnabled: Boolean(factor),
		mfaFactorId: factor?.id ?? null,
		signedIn: true,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/broadcast", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) {
		return c.json({
			configuredDestinations: [],
			teamName: null,
			workspaceId: null,
		}, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const context = await requireAccountWorkspace({
		request: c.req.raw,
		env: c.env,
		workspaceId,
	});
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let teamName;
	let configured;
	try { [teamName, configured] = await Promise.all([getWorkspaceName(c.env, workspaceId), listBroadcastDestinations(c.env, workspaceId)]); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({
		configuredDestinations: configured.map((row) => ({
			id: row.id,
			destinationId: row.destinationId,
			name: row.name,
			enabled: Boolean(row.enabled),
			samplingRate: Number(row.samplingRate ?? 1),
			destinationConfig: null,
			updatedAt: row.updatedAt ?? null,
		})),
		teamName,
		workspaceId,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/apps", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({ apps: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let data;
	try { data = await listWorkspaceApps(c.env, workspaceId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const apps = data
		.filter((app) => !isInternalApp(app.title, app.appKey))
		.map((app) => ({
			app_key: app.appKey,
			category: normalizeAppCategories((app.meta as Record<string, unknown> | null)?.category),
			created_at: app.createdAt,
			docs_url: typeof (app.meta as Record<string, unknown> | null)?.docs_url === "string" ? (app.meta as Record<string, unknown>).docs_url : null,
			id: app.id,
			image_url: app.imageUrl,
			is_active: app.isActive,
			is_public: app.isPublic,
			last_seen: app.lastSeen,
			title: app.title,
			url: app.url,
		}));
	return c.json({ apps }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.put("/apps/:appId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const appId = c.req.param("appId");
	let existing;
	try { existing = await findAccountApp(c.env, appId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (!existing?.workspaceId) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: existing.workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (isInternalApp(existing.title, existing.appKey)) return c.json({ error: "managed_app" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const update: Parameters<typeof updateAccountApp>[1]["values"] = {};
	let category: string | null | undefined;
	let docsUrl: string | null | undefined;
	if (typeof body.title === "string") { const value = body.title.trim(); if (!value) return c.json({ error: "invalid_title" }, 400, PRIVATE_NO_STORE_HEADERS); update.title = value; }
	if (body.url === null) update.url = "about:blank"; else if (typeof body.url === "string") update.url = body.url.trim() || "about:blank";
	for (const field of ["docs_url", "image_url"] as const) {
		if (body[field] === null) {
			if (field === "docs_url") docsUrl = null; else update.imageUrl = null;
		}
		else if (typeof body[field] === "string") {
			const value = body[field].trim();
			if (!value) { if (field === "docs_url") docsUrl = null; else update.imageUrl = null; }
			else { try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); if (field === "docs_url") docsUrl = url.toString(); else update.imageUrl = url.toString(); } catch { return c.json({ error: `invalid_${field}` }, 400, PRIVATE_NO_STORE_HEADERS); } }
		}
	}
	if (typeof body.is_public === "boolean") update.isPublic = body.is_public;
	if (typeof body.is_active === "boolean") update.isActive = body.is_active;
	if (Object.prototype.hasOwnProperty.call(body, "category")) category = normalizeAppCategories(body.category);
	let updatedApp: Record<string, unknown> | null = null;
	if (Object.keys(update).length || category !== undefined || docsUrl !== undefined) {
		let result;
		try { result = await updateAccountApp(c.env, { appId, workspaceId: context.workspaceId, values: update, category, docsUrl }); }
		catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
		if (!result) return c.json({ error: "app_not_updated" }, 409, PRIVATE_NO_STORE_HEADERS);
		updatedApp = { id: result.id, is_public: result.isPublic, is_active: result.isActive, image_url: result.imageUrl };
	}
	const cache = await purgeWorkerCacheTags(c.executionCtx, ["web-api-apps", "web-api-app-ids", "web-api-app-images", "web-api-app-rankings", "web-api-landing", `web-api-app-${encodeURIComponent(appId).replace(/%/g, "")}`]);
	return c.json({ success: true, app: updatedApp, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.post("/apps/:sourceAppId/merge", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const sourceAppId = c.req.param("sourceAppId");
	const body: { targetAppId?: string } = await c.req.json<{ targetAppId?: string }>().catch(() => ({}));
	const targetAppId = String(body.targetAppId ?? "").trim();
	if (!targetAppId || targetAppId === sourceAppId) return c.json({ error: "invalid_target" }, 400, PRIVATE_NO_STORE_HEADERS);
	let apps;
	try { apps = await findAccountApps(c.env, [sourceAppId, targetAppId]); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (apps.length !== 2) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = apps[0].workspaceId;
	if (!workspaceId || !apps.every((app) => app.workspaceId === workspaceId)) return c.json({ error: "invalid_target" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (apps.some((app) => isInternalApp(app.title, app.appKey))) return c.json({ error: "managed_app" }, 403, PRIVATE_NO_STORE_HEADERS);
	let merged;
	try {
		merged = await mergeAppHistory(c.env, { workspaceId, sourceAppId, targetAppId });
	} catch (error) {
		console.error("[web-api/account/settings] app history merge failed", { workspaceId, sourceAppId, targetAppId, error });
		return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
	const dynamic = [sourceAppId, targetAppId].map((id) => `web-api-app-${encodeURIComponent(id).replace(/%/g, "")}`);
	const cache = await purgeWorkerCacheTags(c.executionCtx, ["web-api-apps", "web-api-app-ids", "web-api-app-images", "web-api-app-rankings", "web-api-landing", ...dynamic]);
	return c.json({ success: true, merge: merged, cache }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/authorized-apps", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({ authorizedApps: [], signedIn: false, userId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	let authorizations;
	try { authorizations = await listUserOAuthAuthorizations(c.env, user.id); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const authorizedApps = authorizations.map((authorization) => {
		const grantedScopes = Array.isArray(authorization.scopes) ? authorization.scopes.map(String) : [];
		const allowedScopes = Array.isArray(authorization.allowedScopes) ? authorization.allowedScopes.map(String) : [];
		return {
			authorization_id: authorization.id,
			app_name: authorization.appName ?? "OAuth application",
			app_description: authorization.appDescription,
			app_logo_url: authorization.appLogoUrl,
			app_homepage_url: authorization.appHomepageUrl,
			scopes: grantedScopes,
			additional_scopes: allowedScopes.filter((scope) => !grantedScopes.includes(scope)),
			team_name: authorization.workspaceName ?? "Unknown workspace",
			authorized_at: authorization.createdAt,
			last_used_at: authorization.lastUsedAt,
		};
	});
	return c.json({ authorizedApps, signedIn: true, userId: user.id }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/authorized-apps/:authorizationId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	let result;
	try { result = await findUserOAuthAuthorization(c.env, c.req.param("authorizationId"), user.id); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (!result) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	return c.json({ authorization: { id: result.id, client_id: result.clientId, workspace_id: result.workspaceId, scopes: result.scopes, created_at: result.createdAt, last_used_at: result.lastUsedAt } }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.delete("/authorized-apps/:authorizationId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	try { await revokeUserOAuthAuthorization(c.env, c.req.param("authorizationId"), user.id); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/oauth-apps", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({ initialTeamId: null, oauthApps: [], signedIn: false }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	if (!workspaceId) {
		return c.json({ initialTeamId: null, oauthApps: [], signedIn: true }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let oauthApps;
	try { oauthApps = await listWorkspaceOAuthApps(c.env, workspaceId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ initialTeamId: workspaceId, oauthApps, signedIn: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/oauth-apps/:clientId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ authorizations: [], currentUserId: null, oauthApp: null, recentRequests: [], signedIn: false, usageStats: [], userDirectory: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	const clientId = c.req.param("clientId");
	let details;
	try { details = await loadOAuthAppDetails(c.env, clientId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (!details) return c.json({ authorizations: [], currentUserId: user.id, oauthApp: null, recentRequests: [], signedIn: true, usageStats: [], userDirectory: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = String(details.oauthApp.workspace_id ?? "").trim();
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	return c.json({ authorizations: details.authorizations, currentUserId: user.id, oauthApp: details.oauthApp, recentRequests: details.recentRequests, signedIn: true, usageStats: details.usageStats, userDirectory: details.userDirectory }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/management-api-keys", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) {
		const user = await requireUser(c.req.raw, c.env);
		return c.json({ currentUserId: user?.id, teamsWithKeys: [], workspace: null }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context || !["owner", "admin"].includes(context.role.toLowerCase())) {
		return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	}
	let workspaceName: string | null;
	let managementKeys;
	try { [workspaceName, managementKeys] = await Promise.all([getWorkspaceName(c.env, workspaceId), listManagementKeys(c.env, workspaceId)]); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const workspace = {
		id: workspaceId,
		name: String(workspaceName ?? "").trim() || "Current Workspace",
	};
	return c.json({
		currentUserId: context.user.id,
		teamsWithKeys: [{ ...workspace, keys: managementKeys }],
		workspace,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/byok", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	const now = new Date();
	const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
	const empty = {
		fallbackEnabled: false,
		freeRemaining: 100_000,
		keyEntries: [],
		legacyHiddenTotal: 0,
		monthlyRequestCount: 0,
		nextMonthStartIso: nextMonthStart.toISOString(),
		paidTierRequests: 0,
		workspaceId: null,
	};
	if (!workspaceId) return c.json(empty, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	let byok;
	try { byok = await loadWorkspaceByokSettings(c.env, { workspaceId, monthStart: monthStart.toISOString(), nextMonthStart: nextMonthStart.toISOString() }); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const keyEntries = byok.keyEntries.map((row) => ({
			id: row.id,
			providerId: row.providerId,
			name: row.name,
			...(row.prefix ? { prefix: row.prefix } : {}),
			...(row.suffix ? { suffix: row.suffix } : {}),
			createdAt: row.createdAt,
			lastUsedAt: row.lastUsedAt,
			enabled: row.enabled,
			alwaysUse: row.alwaysUse,
			routingMode: row.routingMode === "priority" ? "priority" : "fallback",
			sortOrder: Number(row.sortOrder ?? 0),
			verificationStatus: row.verificationStatus,
			errorMessage: row.errorMessage,
			allowedModelSlugs: Array.isArray(row.allowedModelSlugs) ? row.allowedModelSlugs.map(String) : [],
			allowedApiKeyIds: Array.isArray(row.allowedApiKeyIds) ? row.allowedApiKeyIds.map(String) : [],
		}));
	const monthlyRequestCount = byok.monthlyRequestCount;
	return c.json({
		fallbackEnabled: byok.fallbackEnabled,
		freeRemaining: Math.max(0, 100_000 - monthlyRequestCount),
		keyEntries,
		legacyHiddenTotal: 0,
		monthlyRequestCount,
		nextMonthStartIso: nextMonthStart.toISOString(),
		paidTierRequests: Math.max(0, monthlyRequestCount - 100_000),
		workspaceId,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/keys", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({
			currentUserId: undefined,
			initialWorkspaceId: null,
			teamsWithKeys: [],
			workspaces: [],
		}, 200, PRIVATE_NO_STORE_HEADERS);
	}
	let accessibleWorkspaces;
	try { accessibleWorkspaces = await listWorkspaceAccess(c.env, user.id); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const workspaces = accessibleWorkspaces.map(({ id, name }) => ({ id, name })).filter((row) => row.id && row.name);
	const accessibleIds = workspaces.map((workspace) => workspace.id);
	const requestedWorkspaceId = c.req.query("workspaceId")?.trim();
	const initialWorkspaceId = requestedWorkspaceId && accessibleIds.includes(requestedWorkspaceId)
		? requestedWorkspaceId
		: workspaces[0]?.id ?? null;
	let keys: Array<Record<string, unknown>> = [];
	if (initialWorkspaceId) {
		const dayStart = new Date();
		dayStart.setUTCHours(0, 0, 0, 0);
		let keyRows: Array<Record<string, unknown>>;
		let usageResult: { data: Array<Record<string, unknown>>; error: unknown };
		try {
			[keyRows, usageResult] = await Promise.all([
				listAccountApiKeys(c.env, initialWorkspaceId),
				getWorkspaceKeyUsage(c.env, initialWorkspaceId, dayStart.toISOString()).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
			]);
		} catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
		const usageByKey = new Map<string, Record<string, unknown>>();
		if (!usageResult.error) {
			for (const row of usageResult.data ?? []) {
				const keyId = typeof row.key_id === "string" ? row.key_id : null;
				if (!keyId) continue;
				usageByKey.set(keyId, {
					current_usage_daily: Number(row.daily_request_count ?? 0) || 0,
					current_usage_weekly: Number(row.weekly_request_count ?? 0) || 0,
					current_usage_monthly: Number(row.monthly_request_count ?? 0) || 0,
					current_usage_daily_cost_nanos: Number(row.daily_cost_nanos ?? 0) || 0,
					current_usage_weekly_cost_nanos: Number(row.weekly_cost_nanos ?? 0) || 0,
					current_usage_monthly_cost_nanos: Number(row.monthly_cost_nanos ?? 0) || 0,
					usage_last_used_at: typeof row.last_used_at === "string" ? row.last_used_at : null,
				});
			}
		}
		keys = keyRows.map((key) => {
			const usage = usageByKey.get(String(key.id ?? "")) ?? {};
			const usageLastUsed = usage.usage_last_used_at;
			const { usage_last_used_at: _ignored, ...usageFields } = usage;
			return {
				...key,
				current_usage_daily: 0,
				current_usage_weekly: 0,
				current_usage_monthly: 0,
				current_usage_daily_cost_nanos: 0,
				current_usage_weekly_cost_nanos: 0,
				current_usage_monthly_cost_nanos: 0,
				...usageFields,
				last_used_at: typeof key.last_used_at === "string" && key.last_used_at
					? key.last_used_at
					: usageLastUsed ?? null,
			};
		});
	}
	const activeWorkspace = workspaces.find((workspace) => workspace.id === initialWorkspaceId);
	return c.json({
		currentUserId: user.id,
		initialWorkspaceId,
		teamsWithKeys: activeWorkspace ? [{ ...activeWorkspace, keys }] : [],
		workspaces,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/credits/onboarding", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	const signerName = user
		? String(user.userMetadata.full_name ?? user.userMetadata.name ?? user.email?.split("@")[0] ?? "Authorized Signer").trim()
		: "Authorized Signer";
	const workspaceId = c.req.query("workspaceId")?.trim();
	const empty = {
		canAccessOnboarding: false,
		canManageBilling: false,
		currentBillingMode: "wallet" as const,
		initialBillingDay: 1,
		initialPaymentTermsDays: 30 as const,
		invoiceProfileEnabled: false,
		signedIn: Boolean(user),
		signerName,
		team: null,
		workspaceId: workspaceId ?? null,
	};
	if (!user || !workspaceId) return c.json(empty, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let workspace;
	try { workspace = await getWorkspaceBillingStatus(c.env, workspaceId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (!workspace) return c.json(empty, 200, PRIVATE_NO_STORE_HEADERS);
	// Invoice onboarding and invoice-profile tables were removed from the canonical
	// schema. Keep the endpoint stable while exposing the only supported wallet flow.
	return c.json({
		canAccessOnboarding: false,
		canManageBilling: ["owner", "admin"].includes(context.role.toLowerCase()),
		currentBillingMode: "wallet",
		initialBillingDay: 1,
		initialPaymentTermsDays: 30,
		invoiceProfileEnabled: false,
		signedIn: true,
		signerName,
		team: {
			name: String(workspace.name ?? "Workspace"),
			tier: String(workspace.tier ?? "basic"),
		},
		workspaceId,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/credits/transactions", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	const empty = {
		billingMode: "wallet" as const,
		invoices: [],
		isEnterpriseInvoiceMode: false,
		stripeCustomerId: null,
		teamTier: "basic",
		transactions: [],
		workspaceId: workspaceId ?? null,
	};
	if (!workspaceId) return c.json(empty, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let billing;
	try { billing = await loadWorkspaceBillingTransactions(c.env, workspaceId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const teamTier = String(billing.workspace?.tier ?? "basic").toLowerCase();
	const billingMode = "wallet" as const;
	const isEnterpriseInvoiceMode = false;
	const transactions = billing.transactions.map((row) => ({
		id: row.id,
		amount_nanos: Number(row.amountNanos ?? 0),
		description: row.kind ?? (row.refType ? `${row.refType}:${row.refId}` : "Purchase"),
		created_at: row.eventTime ?? row.createdAt ?? null,
		status: row.status ?? null,
		kind: row.kind ?? null,
		ref_type: row.refType ?? null,
		ref_id: row.refId ?? null,
		source_ref_type: row.sourceRefType ?? null,
		source_ref_id: row.sourceRefId ?? null,
		before_balance_nanos: row.beforeBalanceNanos == null ? null : Number(row.beforeBalanceNanos),
		after_balance_nanos: row.afterBalanceNanos == null ? null : Number(row.afterBalanceNanos),
	}));
	return c.json({
		billingMode, invoices: [], isEnterpriseInvoiceMode,
		stripeCustomerId: billing.stripeCustomerId,
		teamTier, transactions, workspaceId,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/credits", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({
		declaredCountryCode: null,
		initialBalance: 0,
		latestPaymentSuccessAt: null,
		autoTopUpFailureEmailEnabled: true,
		lowBalanceEmailEnabled: false,
		lowBalanceEmailThresholdUsd: null,
		paymentMethodExpiringEmailEnabled: true,
		obfuscateInfo: false,
		stripeInfo: {
			customer: { id: null, email: null },
			defaultPaymentMethodId: null,
			hasPaymentMethod: false,
			paymentMethods: [],
		},
		wallet: null,
	}, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let billing;
	try { billing = await loadWorkspaceCreditSettings(c.env, workspaceId, context.user.id); }
	catch { return c.json({ error: "billing_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const thresholdNanos = Number(billing.settings?.lowBalanceEmailThresholdNanos ?? 0);
	const cookieOverride = c.req.query("obfuscateInfo");
	return c.json({
		declaredCountryCode: billing.profile?.declaredCountryCode ?? null,
		initialBalance: Number(billing.wallet?.balanceNanos ?? 0) / 1_000_000_000,
		latestPaymentSuccessAt: billing.latestPaymentAt,
		autoTopUpFailureEmailEnabled: billing.settings?.autoTopUpFailureEmailEnabled !== false,
		lowBalanceEmailEnabled: Boolean(billing.settings?.lowBalanceEmailEnabled),
		lowBalanceEmailThresholdUsd: thresholdNanos > 0 ? Number((thresholdNanos / 1_000_000_000).toFixed(2)) : null,
		paymentMethodExpiringEmailEnabled: billing.settings?.paymentMethodExpiringEmailEnabled !== false,
		obfuscateInfo: cookieOverride === "1" ? true : cookieOverride === "0" ? false : Boolean(billing.profile?.obfuscateInfo),
		stripeInfo: {
			customer: { id: null, email: null },
			defaultPaymentMethodId: null,
			hasPaymentMethod: false,
			paymentMethods: [],
		},
		wallet: billing.wallet ? {
			workspace_id: billing.wallet.workspaceId,
			stripe_customer_id: billing.wallet.stripeCustomerId,
			balance_nanos: billing.wallet.balanceNanos,
			reserved_nanos: billing.wallet.reservedNanos,
			auto_top_up_enabled: billing.wallet.autoTopUpEnabled,
			low_balance_threshold: billing.wallet.lowBalanceThreshold,
			auto_top_up_amount: billing.wallet.autoTopUpAmount,
			auto_top_up_account_id: billing.wallet.autoTopUpAccountId,
		} : null,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/payment-methods", async (c) => {
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) return c.json({
		customerId: null,
		initialData: {
			customer: { id: "", email: null },
			defaultPaymentMethodId: null,
			paymentMethods: [],
		},
		obfuscateInfo: false,
	}, 200, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let storedObfuscation;
	try { storedObfuscation = await getAccountObfuscation(c.env, context.user.id); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const cookieOverride = c.req.query("obfuscateInfo");
	return c.json({
		customerId: null,
		initialData: {
			customer: { id: "", email: null },
			defaultPaymentMethodId: null,
			paymentMethods: [],
		},
		obfuscateInfo: cookieOverride === "1" ? true : cookieOverride === "0" ? false : storedObfuscation,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsRouter.get("/observability/destinations/new/:provider", async (c) => {
	const provider = c.req.param("provider");
	if (!OBSERVABILITY_DESTINATIONS.has(provider)) {
		return c.json({ destinationFound: false, keys: [], modelOptions: [], providerOptions: [], teamName: null, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const workspaceId = c.req.query("workspaceId")?.trim();
	if (!workspaceId) {
		return c.json({ destinationFound: true, keys: [], modelOptions: [], providerOptions: [], teamName: null, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	let options;
	try { options = await loadObservabilityDestinationOptions(c.env, workspaceId); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const modelsById = new Map<string, (typeof options.models)[number]>(options.models.map((row) => [row.id, row] as const));
	const modelOptionsById = new Map<string, { value: string; label: string; logoId: string | null; subtitle: string | null }>();
	for (const row of options.routes) {
		const apiModelId = String(row.modelId ?? "").trim();
		if (!apiModelId) continue;
		const model = modelsById.get(row.modelId);
		const label = String(model?.name ?? apiModelId);
		const option = { value: apiModelId, label, logoId: model?.organisationId ?? null, subtitle: label === apiModelId ? null : apiModelId };
		const existing = modelOptionsById.get(apiModelId);
		if (!existing || existing.label === apiModelId) modelOptionsById.set(apiModelId, option);
	}
	return c.json({
		destinationFound: true,
		keys: options.keys.map((key) => ({ id: key.id, name: key.name ?? null, prefix: key.prefix ?? null })),
		modelOptions: Array.from(modelOptionsById.values()).sort((left, right) => left.label.localeCompare(right.label)),
		providerOptions: options.providers.map((item) => ({ value: item.id, label: item.name ?? item.id, logoId: item.id })),
		teamName: options.workspaceName,
		workspaceId,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});
