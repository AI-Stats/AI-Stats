import { afterEach, describe, expect, it, vi } from "vitest";
const appRepositoryMocks = vi.hoisted(() => ({
	findAccountApps: vi.fn(async () => [
		{ id: "source-app", workspaceId: "workspace-1", title: "Source", appKey: "source" },
		{ id: "target-app", workspaceId: "workspace-1", title: "Target", appKey: "target" },
	]),
	listWorkspaceApps: vi.fn(async () => [
		{
			id: "app-1", title: "Customer App", appKey: "customer-app",
			meta: { category: "chat,invalid,research", docs_url: "https://docs.example.com" },
			url: "https://example.com", imageUrl: null, isPublic: true, isActive: true,
			lastSeen: "2026-07-14T00:00:00Z", createdAt: "2026-01-01T00:00:00Z",
		},
		{ id: "internal", title: "Phaseo Chat", appKey: "phaseo-chat", meta: {}, url: "about:blank", imageUrl: null, isPublic: true, isActive: true, lastSeen: "2026-07-14T00:00:00Z", createdAt: "2026-01-01T00:00:00Z" },
	]),
	mergeAppHistory: vi.fn(async () => ({ gateway_requests: 2, request_facts: 2, rollup_rebuild: "queued" as const })),
}));
const oauthAuthorizationMocks = vi.hoisted(() => ({
	listUserOAuthAuthorizations: vi.fn(async () => [{
		id: "authorization-1", clientId: "client-1", workspaceId: "workspace-1",
		scopes: ["models:read"], createdAt: "2026-01-01T00:00:00Z", lastUsedAt: "2026-07-14T00:00:00Z",
		appName: "Example OAuth App", appDescription: "Example", appLogoUrl: null,
		appHomepageUrl: "https://example.com", allowedScopes: ["models:read", "usage:read"], workspaceName: "Team One",
	}]),
	listWorkspaceOAuthApps: vi.fn(async () => [{ client_id: "client-1", workspace_id: "workspace-1", name: "Example OAuth App" }]),
	loadOAuthAppDetails: vi.fn(async () => ({
		oauthApp: { client_id: "client-1", workspace_id: "workspace-1", name: "Example OAuth App" },
		authorizations: [{ id: "authorization-1", user_id: "user-1" }],
		usageStats: [{ created_at: "2026-07-14T00:00:00Z", success: true, cost_nanos: 1000 }],
		recentRequests: [{ request_id: "request-1", oauth_user_id: "user-1", success: true }],
		userDirectory: [{ user_id: "user-1", full_name: "Test User", email: "user@example.com" }],
	})),
}));
import app from "@/index";

vi.mock("@/repositories/apps", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/apps")>()),
	...appRepositoryMocks,
}));

vi.mock("@/repositories/oauth-apps", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/oauth-apps")>()),
	...oauthAuthorizationMocks,
}));

vi.mock("@/repositories/settings-summary", () => ({
	getPreviousMonthSpendCents: vi.fn(async () => 0),
	getWorkspaceKeyUsage: vi.fn(async () => [{
		key_id: "key-1", daily_request_count: 3, weekly_request_count: 20,
		monthly_request_count: 80, daily_cost_nanos: 100, weekly_cost_nanos: 500,
		monthly_cost_nanos: 2000, last_used_at: "2026-07-14T00:00:00Z",
	}]),
}));

vi.mock("@/repositories/settings-keys", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/settings-keys")>()),
	listAccountApiKeys: vi.fn(async () => [{ id: "key-1", workspace_id: "workspace-1", name: "Production", status: "active", last_used_at: null }]),
	listManagementKeys: vi.fn(async () => [{ id: "management-key-1", workspaceId: "workspace-1", name: "Automation", createdAt: "2026-01-01T00:00:00Z" }]),
}));

vi.mock("@/repositories/workspace-access", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/workspace-access")>()),
	getWorkspaceAccess: vi.fn(async (_env, _userId: string, workspaceId: string) => workspaceId && workspaceId !== "workspace-2" ? ({ workspaceId, role: "owner" as const }) : null),
	getWorkspaceName: vi.fn(async () => "Team One"),
	listWorkspaceAccess: vi.fn(async () => [{ id: "workspace-1", name: "Team One", slug: "team-one", role: "owner" as const }]),
}));

vi.mock("@/repositories/byok", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/byok")>()),
	loadWorkspaceByokSettings: vi.fn(async () => ({
		fallbackEnabled: false,
		monthlyRequestCount: 100_250,
		keyEntries: [{
			id: "byok-new", providerId: "openai", name: "OpenAI key", prefix: "sk-", suffix: "1234",
			createdAt: "2026-07-01T00:00:00Z", lastUsedAt: "2026-07-15T12:00:00Z", enabled: true,
			alwaysUse: true, routingMode: "priority", sortOrder: 0, verificationStatus: "format_valid_strict",
			errorMessage: null, allowedModelSlugs: [], allowedApiKeyIds: [],
		}, {
			id: "byok-old", providerId: "openai", name: "Old key", prefix: "sk-", suffix: "0000",
			createdAt: "2026-01-01T00:00:00Z", lastUsedAt: null, enabled: false,
			alwaysUse: false, routingMode: "fallback", sortOrder: 0, verificationStatus: null,
			errorMessage: null, allowedModelSlugs: [], allowedApiKeyIds: [],
		}],
	})),
}));

vi.mock("@/repositories/billing-settings", () => ({
	getWorkspaceBillingStatus: vi.fn(async () => ({ name: "Team One", slug: "team-one", tier: "enterprise", billingMode: "invoice" })),
	loadWorkspaceBillingTransactions: vi.fn(async () => ({
		workspace: { tier: "enterprise", billingMode: "invoice" },
		stripeCustomerId: "cus_test",
		transactions: [{
			id: "ledger-1", eventTime: "2026-07-13T00:00:00Z", kind: "Purchase", amountNanos: 10_000_000_000,
			beforeBalanceNanos: 2_500_000_000, afterBalanceNanos: 12_500_000_000, status: "paid",
			refType: "Stripe_Payment_Intent", refId: "pi_1", sourceRefType: null, sourceRefId: null,
			createdAt: "2026-07-13T00:00:00Z",
		}],
	})),
	loadWorkspaceCreditSettings: vi.fn(async () => ({
		wallet: { workspaceId: "workspace-1", stripeCustomerId: "cus_test", balanceNanos: 12_500_000_000, reservedNanos: 0, autoTopUpEnabled: false, lowBalanceThreshold: 0, autoTopUpAmount: 0, autoTopUpAccountId: null },
		settings: { lowBalanceEmailEnabled: true, lowBalanceEmailThresholdNanos: 5_000_000_000, autoTopUpFailureEmailEnabled: true, paymentMethodExpiringEmailEnabled: true },
		latestPaymentAt: "2026-07-13T00:00:00Z",
		profile: { obfuscateInfo: false, declaredCountryCode: null },
	})),
	getAccountObfuscation: vi.fn(async () => false),
}));

vi.mock("@/repositories/account-auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/account-auth")>()),
	getAccountProfile: vi.fn(async () => ({ userId: "user-1", role: "user", betaOptIn: true, betaFeatures: { models_catalogue_v2: true }, displayName: "Test User", defaultWorkspaceId: "workspace-1", obfuscateInfo: false, declaredCountryCode: null, createdAt: "2025-01-01T00:00:00Z" })),
	listAccountWorkspaces: vi.fn(async () => [{ id: "workspace-1", name: "Team One", slug: "team-one", role: "owner" }]),
	saveAccountBetaProfile: vi.fn(async () => undefined),
}));

vi.mock("@/repositories/guardrails", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/guardrails")>()),
	loadPrivacySettings: vi.fn(async () => ({
		workspace: { id: "workspace-1", name: "Team One" },
		settings: {
			privacyEnablePaidMayTrain: true, privacyEnableFreeMayTrain: true,
			privacyEnableFreeMayPublishPrompts: true, privacyEnableInputOutputLogging: true,
			privacyZdrOnly: true, ioLoggingEnabled: false, ioLoggingRetentionDays: 90,
			ioLoggingIncludeProviderPayloads: true, providerRestrictionMode: "allowlist",
			providerRestrictionProviderIds: ["openai-eu"], providerRestrictionEnforceAllowed: false,
			modelRestrictionMode: "none", modelRestrictionModelIds: [], responseHealingEnabled: false,
			responseHealingLocked: false, responseHealingMode: "safe",
		},
		account: null,
		providers: [{ providerSlug: "openai-eu", name: "OpenAI", providerFamilySlug: "openai", offerLabel: "OpenAI EU", offerScope: "regional" }],
		routes: [{ providerSlug: "openai-eu", modelSlug: "gpt-test" }],
		models: [{ model: { modelSlug: "gpt-test", name: "GPT Test", labSlug: "openai" }, lab: { labSlug: "openai", name: "OpenAI" } }],
	})),
	getPrivacyPolicies: vi.fn(async () => ({
		workspace: { privacyEnablePaidMayTrain: true, privacyEnableFreeMayTrain: true, privacyZdrOnly: true, providerRestrictionMode: "none", providerRestrictionProviderIds: [] },
		account: null,
	})),
}));

vi.mock("@/repositories/broadcast", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/repositories/broadcast")>()),
	listBroadcastDestinations: vi.fn(async () => [{ id: "destination-row-1", destinationId: "destination-1", name: "Primary", enabled: true, samplingRate: 0.5, updatedAt: "2026-07-14T00:00:00Z" }]),
}));

vi.mock("@/repositories/observability-settings", () => ({
	loadObservabilityDestinationOptions: vi.fn(async () => ({
		workspaceName: "Team One",
		keys: [{ id: "key-1", name: "Production", prefix: "key" }],
		providers: [{ id: "openai-eu", name: "OpenAI" }],
		routes: [{ providerId: "openai-eu", modelId: "gpt-test" }],
		models: [{ id: "gpt-test", name: "GPT Test", organisationId: "openai" }],
	})),
}));

const env = {
	ENV: "development" as const,
};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function authenticatedFetch(input: RequestInfo | URL): Response {
	const url = input instanceof Request ? input.url : String(input);
	if (url.includes("/auth/v1/user")) {
		return new Response(JSON.stringify({
			id: "user-1",
			email: "user@example.com",
			created_at: "2025-01-01T00:00:00Z",
			app_metadata: { provider: "email" },
			factors: [{ id: "factor-1", factor_type: "totp", status: "verified" }],
		}), { status: 200 });
	}
	if (url.includes("workspace_members") && url.includes("teams%3Aworkspaces")) {
		return new Response(JSON.stringify([{
			workspace_id: "workspace-1",
			teams: { id: "workspace-1", name: "Team One" },
		}]), { status: 200 });
	}
	if (url.includes("workspace_members") && url.includes("select=workspace_id")) {
		return new Response(JSON.stringify([{ workspace_id: "workspace-1" }]), { status: 200 });
	}
	if (url.includes("workspace_members")) {
		return new Response(JSON.stringify([{ role: "admin" }]), { status: 200 });
	}
	if (url.includes("select=owner_user_id")) {
		return new Response(JSON.stringify([{ owner_user_id: "user-1" }]), { status: 200 });
	}
	if (url.includes("name%2Ctier%2Cbilling_mode")) {
		return new Response(JSON.stringify([{ name: "Team One", tier: "enterprise", billing_mode: "invoice" }]), { status: 200 });
	}
	if (url.includes("tier%2Cbilling_mode")) {
		return new Response(JSON.stringify([{ tier: "enterprise", billing_mode: "invoice" }]), { status: 200 });
	}
	if (url.includes("beta_opt_in")) {
		return new Response(JSON.stringify([{
			beta_opt_in: true,
			beta_features: { models_catalogue_v2: true },
		}]), { status: 200 });
	}
	if (url.includes("obfuscate_info")) {
		return new Response(JSON.stringify([{
			user_id: "user-1",
			display_name: "Test User",
			default_workspace_id: "workspace-1",
			obfuscate_info: false,
			created_at: "2025-01-01T00:00:00Z",
		}]), { status: 200 });
	}
	if (url.includes("workspace_settings")) {
		if (url.includes("low_balance_email")) {
			return new Response(JSON.stringify([{
				low_balance_email_enabled: true,
				low_balance_email_threshold_nanos: 5000000000,
			}]), { status: 200 });
		}
		return new Response(JSON.stringify([{
			privacy_zdr_only: true,
			provider_restriction_mode: "allow",
		}]), { status: 200 });
	}
	if (url.includes("/wallets")) {
		return new Response(JSON.stringify([{
			workspace_id: "workspace-1", stripe_customer_id: "cus_test",
			balance_nanos: 12500000000, reserved_nanos: 0, auto_top_up_enabled: false,
		}]), { status: 200 });
	}
	if (url.includes("credit_ledger")) {
		return new Response(JSON.stringify([{
			event_time: "2026-07-13T00:00:00Z", status: "paid", amount_nanos: 10000000000,
		}]), { status: 200 });
	}
	if (url.includes("v2_providers")) {
		return new Response(JSON.stringify([{
			api_provider_id: "openai-eu",
			api_provider_name: "OpenAI",
			offer_label: "OpenAI EU",
			offer_scope: "regional",
		}]), { status: 200 });
	}
	if (url.includes("v2_model_provider_routes")) {
		return new Response(JSON.stringify([{
			provider_id: "openai-eu",
			api_model_id: "gpt-test",
			model_id: "openai/gpt-test",
			internal_model_id: "openai/gpt-test",
			is_active_gateway: true,
		}]), { status: 200 });
	}
	if (url.includes("v2_models")) {
		return new Response(JSON.stringify([{
			model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai",
		}]), { status: 200 });
	}
	if (url.includes("workspace_broadcast_destinations")) {
		return new Response(JSON.stringify([{
			id: "destination-row-1",
			destination_id: "destination-1",
			name: "Primary",
			enabled: true,
			sampling_rate: 0.5,
			destination_config: { url: "https://example.com" },
			updated_at: "2026-07-14T00:00:00Z",
		}]), { status: 200 });
	}
	if (url.includes("api_apps")) {
		return new Response(JSON.stringify([
			{
				id: "app-1", title: "Customer App", app_key: "customer-app",
				category: "chat,invalid,research", docs_url: "https://docs.example.com",
				url: "https://example.com", image_url: null, is_public: true,
				is_active: true, last_seen: "2026-07-14T00:00:00Z",
				created_at: "2026-01-01T00:00:00Z",
			},
			{ id: "internal", title: "Phaseo Chat", app_key: "phaseo-chat", is_active: true },
		]), { status: 200 });
	}
	if (url.includes("oauth_authorizations")) {
		return new Response(JSON.stringify([{
			id: "authorization-1", client_id: "client-1", workspace_id: "workspace-1",
			scopes: ["models:read"], created_at: "2026-01-01T00:00:00Z",
			last_used_at: "2026-07-14T00:00:00Z",
		}]), { status: 200 });
	}
	if (url.includes("oauth_app_metadata")) {
		return new Response(JSON.stringify([{
			client_id: "client-1", name: "Example OAuth App", description: "Example",
			logo_url: null, homepage_url: "https://example.com",
			allowed_scopes: ["models:read", "usage:read"],
		}]), { status: 200 });
	}
	if (url.includes("oauth_apps_with_stats")) {
		return new Response(JSON.stringify([{
			client_id: "client-1", workspace_id: "workspace-1", name: "Example OAuth App",
		}]), { status: 200 });
	}
	if (url.includes("gateway_requests")) {
		if (url.includes("request_id")) {
			return new Response(JSON.stringify([{
				request_id: "request-1", created_at: "2026-07-14T00:00:00Z",
				oauth_user_id: "user-1", endpoint: "chat/completions", model_id: "openai/gpt-test",
				provider: "openai", success: true, status_code: 200, error_code: null,
				cost_nanos: 1000, latency_ms: 120,
			}]), { status: 200 });
		}
		return new Response(JSON.stringify([{
			created_at: "2026-07-14T00:00:00Z", success: true, cost_nanos: 1000,
		}]), { status: 200 });
	}
	if (url.includes("management_keys")) {
		return new Response(JSON.stringify([{
			id: "management-key-1", workspace_id: "workspace-1", name: "Automation",
			created_at: "2026-01-01T00:00:00Z",
		}]), { status: 200 });
	}
	if (url.includes("/rest/v1/keys?")) {
		return new Response(JSON.stringify([{
			id: "key-1", workspace_id: "workspace-1", name: "Production",
			status: "active", last_used_at: null,
		}]), { status: 200 });
	}
	if (url.includes("byok_keys")) {
		return new Response(JSON.stringify([
			{
				id: "byok-new", provider_id: "openai", name: "OpenAI key", prefix: "sk-",
				suffix: "1234", created_at: "2026-07-01T00:00:00Z", enabled: true, always_use: true,
				last_used_at: "2026-07-15T12:00:00Z", verification_status: "format_valid_strict", error_message: null,
			},
			{
				id: "byok-old", provider_id: "openai", name: "Old key", prefix: "sk-",
				suffix: "0000", created_at: "2026-01-01T00:00:00Z", enabled: false, always_use: false,
			},
		]), { status: 200 });
	}
	if (url.includes("workspace_byok_monthly_usage")) {
		return new Response(JSON.stringify([{ request_count: 100_250 }]), { status: 200 });
	}
	if (url.includes("workspace_invoice_profiles")) {
		return new Response(JSON.stringify([{
			enabled: true, billing_day: 15, payment_terms_days: 14,
		}]), { status: 200 });
	}
	if (url.includes("workspace_invoices")) {
		return new Response(JSON.stringify([{
			id: "invoice-1", period_start: "2026-06-01", period_end: "2026-06-30",
			amount_nanos: 12000000000, currency: "USD", status: "issued",
		}]), { status: 200 });
	}
	if (url.includes("select=id%2Cname")) {
		return new Response(JSON.stringify([{ id: "workspace-1", name: "Team One" }]), { status: 200 });
	}
	if (url.includes("/workspaces") && url.includes("select=id") && url.includes("owner_user_id")) {
		return new Response(JSON.stringify([{ id: "workspace-1" }]), { status: 200 });
	}
	return new Response(JSON.stringify([]), { status: 200 });
}

describe("account settings routes", () => {
	it("returns private layout, beta, and privacy bootstrap data", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => authenticatedFetch(input)));
		const init = {
			headers: { authorization: "Bearer session-token" },
		};
		const [layout, beta, privacy, broadcast, danger, details, mfa, apps, authorizedApps, oauthApps, managementKeys, byok, keys, onboarding, transactions, credits, paymentMethods, oauthAppDetail, observability, workspacePrivacy] = await Promise.all([
			app.request("https://phaseo.app/api/account/settings/layout?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/beta", init, env),
			app.request("https://phaseo.app/api/account/settings/privacy?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/broadcast?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/account/danger", init, env),
			app.request("https://phaseo.app/api/account/settings/account/details?obfuscateInfo=1", init, env),
			app.request("https://phaseo.app/api/account/settings/account/mfa", init, env),
			app.request("https://phaseo.app/api/account/settings/apps?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/authorized-apps", init, env),
			app.request("https://phaseo.app/api/account/settings/oauth-apps?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/management-api-keys?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/byok?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/keys?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/credits/onboarding?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/credits/transactions?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/credits?workspaceId=workspace-1&obfuscateInfo=1", init, env),
			app.request("https://phaseo.app/api/account/settings/payment-methods?workspaceId=workspace-1&obfuscateInfo=1", init, env),
			app.request("https://phaseo.app/api/account/settings/oauth-apps/client-1", init, env),
			app.request("https://phaseo.app/api/account/settings/observability/destinations/new/webhook?workspaceId=workspace-1", init, env),
			app.request("https://phaseo.app/api/account/settings/workspace/privacy-settings?workspaceId=workspace-1", init, env),
		]);

		for (const response of [layout, beta, privacy, broadcast, danger, details, mfa, apps, authorizedApps, oauthApps, managementKeys, byok, keys, onboarding, transactions, credits, paymentMethods, oauthAppDetail, observability, workspacePrivacy]) {
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
		}
		await expect(layout.json()).resolves.toEqual({
			isEnterpriseInvoiceMode: false,
			showBroadcast: true,
			signedIn: true,
			workspaceId: "workspace-1",
			workspaceName: "Team One",
		});
		await expect(beta.json()).resolves.toMatchObject({
			signedIn: true,
			profile: { betaOptIn: true, betaFeatures: { models_catalogue_v2: true } },
		});
		await expect(privacy.json()).resolves.toMatchObject({
			workspaceId: "workspace-1",
			teamName: "Team One",
			initialGlobal: { privacy_zdr_only: true },
			providers: [{ id: "openai-eu", name: "OpenAI (EU)" }],
			activeProviderModels: [{
				apiModelId: "gpt-test",
				internalModelId: "gpt-test",
				providerId: "openai-eu",
			}],
		});
		await expect(broadcast.json()).resolves.toMatchObject({
			workspaceId: "workspace-1",
			teamName: "Team One",
			configuredDestinations: [{
				id: "destination-row-1",
				destinationId: "destination-1",
				samplingRate: 0.5,
			}],
		});
		await expect(danger.json()).resolves.toEqual({ signedIn: true });
		await expect(details.json()).resolves.toEqual({
			hasPassword: true,
			teams: [{ id: "workspace-1", name: "Team One" }],
			user: {
				id: "user-1",
				displayName: "Test User",
				email: "user@example.com",
				defaultWorkspaceId: "workspace-1",
				declaredCountryCode: null,
				countryStorageAvailable: true,
				obfuscateInfo: true,
				createdAt: "2025-01-01T00:00:00Z",
			},
		});
		await expect(mfa.json()).resolves.toEqual({
			hasPassword: true,
			mfaEnabled: true,
			mfaFactorId: "better-auth-totp",
			signedIn: true,
		});
		await expect(apps.json()).resolves.toMatchObject({
			apps: [{
				id: "app-1",
				category: "chat,research",
				title: "Customer App",
			}],
		});
		await expect(authorizedApps.json()).resolves.toMatchObject({
			signedIn: true,
			userId: "user-1",
			authorizedApps: [{
				authorization_id: "authorization-1",
				app_name: "Example OAuth App",
				additional_scopes: ["usage:read"],
				team_name: "Team One",
			}],
		});
		await expect(oauthApps.json()).resolves.toMatchObject({
			initialTeamId: "workspace-1",
			signedIn: true,
			oauthApps: [{ client_id: "client-1" }],
		});
		await expect(managementKeys.json()).resolves.toMatchObject({
			currentUserId: "user-1",
			workspace: { id: "workspace-1", name: "Team One" },
			teamsWithKeys: [{ keys: [{ id: "management-key-1" }] }],
		});
		await expect(byok.json()).resolves.toMatchObject({
			fallbackEnabled: false,
			freeRemaining: 0,
			keyEntries: [
				{ id: "byok-new", providerId: "openai", suffix: "1234", lastUsedAt: "2026-07-15T12:00:00Z", verificationStatus: "format_valid_strict", errorMessage: null },
				{ id: "byok-old", providerId: "openai", suffix: "0000", lastUsedAt: null, verificationStatus: null, errorMessage: null },
			],
			legacyHiddenTotal: 0,
			monthlyRequestCount: 100250,
			paidTierRequests: 250,
			workspaceId: "workspace-1",
		});
		await expect(keys.json()).resolves.toMatchObject({
			currentUserId: "user-1",
			initialWorkspaceId: "workspace-1",
			workspaces: [{ id: "workspace-1", name: "Team One" }],
			teamsWithKeys: [{
				id: "workspace-1",
				keys: [{
					id: "key-1",
					current_usage_daily: 3,
					current_usage_monthly_cost_nanos: 2000,
					last_used_at: "2026-07-14T00:00:00Z",
				}],
			}],
		});
		await expect(onboarding.json()).resolves.toMatchObject({
			canAccessOnboarding: false,
			canManageBilling: true,
			currentBillingMode: "wallet",
			initialBillingDay: 1,
			initialPaymentTermsDays: 30,
			invoiceProfileEnabled: false,
			signedIn: true,
			workspaceId: "workspace-1",
		});
		await expect(transactions.json()).resolves.toMatchObject({
			billingMode: "wallet",
			isEnterpriseInvoiceMode: false,
			teamTier: "enterprise",
			invoices: [],
			transactions: [{ id: "ledger-1", amount_nanos: 10000000000 }],
			workspaceId: "workspace-1",
		});
		await expect(credits.json()).resolves.toMatchObject({
			initialBalance: 12.5,
			latestPaymentSuccessAt: "2026-07-13T00:00:00Z",
			lowBalanceEmailEnabled: true,
			lowBalanceEmailThresholdUsd: 5,
			obfuscateInfo: true,
			stripeInfo: {
				customer: { id: null, email: null },
				defaultPaymentMethodId: null,
				hasPaymentMethod: false,
				paymentMethods: [],
			},
		});
		await expect(paymentMethods.json()).resolves.toMatchObject({
			customerId: null,
			obfuscateInfo: true,
			initialData: {
				customer: { id: "", email: null },
				defaultPaymentMethodId: null,
				paymentMethods: [],
			},
		});
		await expect(oauthAppDetail.json()).resolves.toMatchObject({
			currentUserId: "user-1",
			signedIn: true,
			oauthApp: { client_id: "client-1", workspace_id: "workspace-1" },
			recentRequests: [{ request_id: "request-1", success: true }],
			usageStats: [{ success: true, cost_nanos: 1000 }],
		});
		await expect(observability.json()).resolves.toMatchObject({
			destinationFound: true,
			teamName: "Team One",
			workspaceId: "workspace-1",
			keys: [{ id: "key-1", name: "Production" }],
			providerOptions: [{ value: "openai-eu", label: "OpenAI" }],
			modelOptions: [{ value: "gpt-test", label: "GPT Test", logoId: "openai" }],
		});
		await expect(workspacePrivacy.json()).resolves.toMatchObject({
			isAuthenticated: true,
			privacyZdrOnly: true,
			providerRestrictionMode: "none",
		});
	});

	it("returns an anonymous private danger response without caching", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401 })));
		const response = await app.request(
			"https://phaseo.app/api/account/settings/account/danger",
			{},
			env,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		await expect(response.json()).resolves.toEqual({ signedIn: false });
	});

	it("merges authoritative requests and queues V2 analytics through one Drizzle transaction", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url.includes("api_apps") && url.includes("id=in.")) {
				return new Response(JSON.stringify([
					{ id: "source-app", workspace_id: "workspace-1", title: "Source", app_key: "source" },
					{ id: "target-app", workspace_id: "workspace-1", title: "Target", app_key: "target" },
				]), { status: 200 });
			}
			return authenticatedFetch(input);
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await app.request(
			"https://phaseo.app/api/account/settings/apps/source-app/merge",
			{
				method: "POST",
				headers: { authorization: "Bearer session-token", "content-type": "application/json" },
				body: JSON.stringify({ targetAppId: "target-app" }),
			},
			env,
			{
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
				props: {},
			} as unknown as ExecutionContext,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			merge: { gateway_requests: 2, request_facts: 2 },
		});
		expect(appRepositoryMocks.mergeAppHistory).toHaveBeenCalledWith(expect.anything(), {
			workspaceId: "workspace-1",
			sourceAppId: "source-app",
			targetAppId: "target-app",
		});
	});

	it("rejects a workspace that is not accessible to the authenticated user", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/auth/v1/user")) {
				return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));
		const response = await app.request(
			"https://phaseo.app/api/account/settings/privacy?workspaceId=workspace-2",
			{ headers: { authorization: "Bearer session-token" } },
			env,
		);
		expect(response.status).toBe(403);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
});
