/**
 * OAuth Clients Platform Endpoint
 *
 * Provides programmatic API access to OAuth client management.
 * This allows developers to manage their OAuth apps via API (not just web UI).
 *
 * Authentication: Requires valid management API key
 * Authorization: Team-scoped (can only manage own team's OAuth apps)
 *
 * Endpoints:
 * - POST   /v1/oauth-clients      Create new OAuth app
 * - GET    /v1/oauth-clients      List team's OAuth apps
 * - GET    /v1/oauth-clients/:id  Get specific OAuth app
 * - PATCH  /v1/oauth-clients/:id  Update OAuth app
 * - DELETE /v1/oauth-clients/:id  Delete OAuth app
 * - POST   /v1/oauth-clients/:id/regenerate-secret  Regenerate secret
 */

import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { configureRuntime, clearRuntime } from "@/runtime/env";
import { z } from "zod";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES, GATEWAY_ACCESS_SCOPE, normalizeScopeList } from "@/lib/authz/capabilities";
import { requireCapability, requireOAuthWorkspaceRole } from "./route-helpers";
import { createOpaqueCode, hashOAuthClientSecret, isThirdPartyOAuthEnabled } from "@/lib/oauth/service";
import {
	createOAuthAppMetadata,
	deleteOAuthAppAndRevokeAuthorizations,
	findOAuthAppWithStats,
	findOwnedOAuthApp,
	listOAuthAppsWithStats,
	resolveWorkspaceOwnerUserId,
	updateOAuthAppMetadata,
} from "@/repositories/oauth";

const app = new Hono<Env>();
const DEFAULT_THIRD_PARTY_ALLOWED_SCOPES = [
	"openid",
	"profile",
	"email",
	GATEWAY_ACCESS_SCOPE,
	CAPABILITIES.ME_READ,
	CAPABILITIES.WORKSPACES_READ,
	CAPABILITIES.MODELS_READ,
	CAPABILITIES.PROVIDERS_READ,
	CAPABILITIES.PRICING_READ,
] as const;

function readAuthContext(ctx: Env["Variables"]["ctx"] | undefined): {
	workspaceId: string | null;
	userId: string | null;
	authMethod: "api_key" | "oauth" | null;
	scopes: string[];
} {
	const authMethod = ctx?.authMethod;
	const scopes = ctx?.scopes;
	return {
		workspaceId: typeof ctx?.workspaceId === "string" ? ctx.workspaceId : null,
		userId: typeof ctx?.userId === "string" ? ctx.userId : null,
		authMethod: authMethod === "api_key" || authMethod === "oauth" ? authMethod : null,
		scopes: Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === "string") : [],
	};
}

app.use("*", async (c, next) => {
	configureRuntime(c.env);
	try {
		const auth = await guardManagementAuth(c.req.raw, { useKvCache: false });
		if (!auth.ok) {
			return (auth as GuardErr).response;
		}
		c.set("ctx", {
			workspaceId: auth.value.workspaceId,
			userId: auth.value.userId ?? null,
			apiKeyId: auth.value.apiKeyId,
			apiKeyRef: auth.value.apiKeyRef,
			apiKeyKid: auth.value.apiKeyKid,
			internal: auth.value.internal,
			authMethod: auth.value.authMethod ?? null,
			scopes: auth.value.scopes ?? auth.value.oauthScopes ?? [],
		});
		return await next();
	} finally {
		clearRuntime();
	}
});

function isHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password;
	} catch {
		return false;
	}
}

function isSafeOAuthRedirect(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.username || url.password || url.hash) return false;
		if (url.protocol === "https:") return true;
		return url.protocol === "http:" &&
			(url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]" || url.hostname === "localhost");
	} catch {
		return false;
	}
}

const httpsUrlSchema = z.string().url().refine(isHttpsUrl, "URL must use HTTPS");
const oauthRedirectSchema = z.string().url().refine(
	isSafeOAuthRedirect,
	"Redirect URI must use HTTPS, except for loopback development callbacks",
);

// Validation schemas
const createOAuthClientSchema = z.object({
	name: z.string().min(3).max(100),
	client_type: z.enum(["public", "confidential"]).default("confidential"),
	allowed_scopes: z.array(z.string().trim().min(1)).optional(),
	description: z.string().optional(),
	homepage_url: httpsUrlSchema.optional(),
	redirect_uris: z.array(oauthRedirectSchema).min(1),
	logo_url: httpsUrlSchema.optional(),
	privacy_policy_url: httpsUrlSchema.optional(),
	terms_of_service_url: httpsUrlSchema.optional(),
});

const updateOAuthClientSchema = z.object({
	name: z.string().min(3).max(100).optional(),
	allowed_scopes: z.array(z.string().trim().min(1)).optional(),
	description: z.string().optional(),
	homepage_url: httpsUrlSchema.optional(),
	logo_url: httpsUrlSchema.optional(),
	privacy_policy_url: httpsUrlSchema.optional(),
	terms_of_service_url: httpsUrlSchema.optional(),
	redirect_uris: z.array(oauthRedirectSchema).min(1).optional(),
});

async function resolveCreatorUserId(workspaceId: string): Promise<string> {
	const ownerUserId = await resolveWorkspaceOwnerUserId(workspaceId);
	if (!ownerUserId) {
		throw new Error("Workspace owner is required to create OAuth apps");
	}
	return ownerUserId;
}

function resolveAllowedScopes(
	input: unknown,
	defaultScopes: readonly string[] = DEFAULT_THIRD_PARTY_ALLOWED_SCOPES,
) {
	return normalizeScopeList(input, {
		allowIdentityScopes: true,
		defaultScopes,
	});
}

function serializeOAuthClientRecord(
	record: Record<string, unknown>,
	options: { clientSecret?: string | null } = {},
) {
	const {
		client_secret_hash: _clientSecretHash,
		...rest
	} = record;
	return {
		...rest,
		...(options.clientSecret !== undefined
			? { client_secret: options.clientSecret }
			: {}),
	};
}

function thirdPartyOAuthComingSoon() {
	return new Response(
		JSON.stringify({
			error: "third_party_oauth_disabled",
			message: "OAuth client management is coming soon. The Phaseo CLI is available during the private OAuth beta.",
		}),
		{
			status: 403,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store",
			},
		},
	);
}

/**
 * POST /v1/oauth-clients
 *
 * Create a new OAuth application
 */
app.post("/", async (c) => {
	try {
		// Get authenticated context from middleware
		const authCtx = readAuthContext(c.get("ctx"));
		if (!authCtx.workspaceId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const scopeError = requireCapability(authCtx, CAPABILITIES.OAUTH_CLIENTS_WRITE);
		if (scopeError) return scopeError;
		const roleError = await requireOAuthWorkspaceRole(authCtx, authCtx.workspaceId, ["owner", "admin"]);
		if (roleError) return roleError;
		if (!isThirdPartyOAuthEnabled()) return thirdPartyOAuthComingSoon();

		// Parse and validate input
		const body = await c.req.json();
		const parsed = createOAuthClientSchema.safeParse(body);

		if (!parsed.success) {
			return c.json(
				{
					error: "Validation error",
					details: parsed.error.issues,
				},
				400
			);
		}

		const input = parsed.data;
		const createdBy = authCtx.userId ?? await resolveCreatorUserId(authCtx.workspaceId);
		const clientType = input.client_type;
		const allowedScopes = resolveAllowedScopes(input.allowed_scopes);
		if (allowedScopes.ok === false) {
			return c.json({ error: allowedScopes.message }, 400);
		}

		const oauthClient = {
			client_id: crypto.randomUUID(),
			client_secret: clientType === "confidential" ? createOpaqueCode() : null,
		};

		const clientSecretHash =
			typeof oauthClient.client_secret === "string" && oauthClient.client_secret.trim().length > 0
				? await hashOAuthClientSecret(oauthClient.client_secret)
				: null;

		// Store metadata in database
		let metadata;
		try {
			metadata = await createOAuthAppMetadata({
				clientId: oauthClient.client_id,
				workspaceId: authCtx.workspaceId,
				name: input.name,
				description: input.description,
				redirectUris: input.redirect_uris,
				homepageUrl: input.homepage_url,
				logoUrl: input.logo_url,
				privacyPolicyUrl: input.privacy_policy_url,
				termsOfServiceUrl: input.terms_of_service_url,
				clientType,
				allowedScopes: allowedScopes.value,
				clientSecretHash: clientType === "confidential" ? clientSecretHash : null,
				createdBy,
				status: "active",
			});
		} catch (error) {
			console.error("Error storing OAuth metadata:", error);
			return c.json({ error: "Failed to create OAuth app" }, 500);
		}

		return c.json(
			serializeOAuthClientRecord(
				metadata as Record<string, unknown>,
				{
					clientSecret:
						clientType === "confidential" ? oauthClient.client_secret : null,
				},
			),
			201
		);
	} catch (error: any) {
		console.error("Error creating OAuth client:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * GET /v1/oauth-clients
 *
 * List all OAuth apps for the authenticated team
 */
app.get("/", async (c) => {
	try {
		const authCtx = readAuthContext(c.get("ctx"));
		if (!authCtx.workspaceId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const scopeError = requireCapability(authCtx, CAPABILITIES.OAUTH_CLIENTS_READ);
		if (scopeError) return scopeError;
		const roleError = await requireOAuthWorkspaceRole(authCtx, authCtx.workspaceId, ["owner", "admin"]);
		if (roleError) return roleError;
		if (!isThirdPartyOAuthEnabled()) return thirdPartyOAuthComingSoon();

		// Fetch OAuth apps for workspace and attach derived stats
		const apps = await listOAuthAppsWithStats(authCtx.workspaceId);

		return c.json({
			data: (apps || []).map((entry) =>
				serializeOAuthClientRecord(entry as Record<string, unknown>),
			),
			pagination: {
				total: apps?.length || 0,
				page: 1,
				per_page: 100,
			},
		});
	} catch (error: any) {
		console.error("Error listing OAuth clients:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * GET /v1/oauth-clients/:clientId
 *
 * Get details for a specific OAuth app
 */
app.get("/:clientId", async (c) => {
	try {
		const authCtx = readAuthContext(c.get("ctx"));
		if (!authCtx.workspaceId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const scopeError = requireCapability(authCtx, CAPABILITIES.OAUTH_CLIENTS_READ);
		if (scopeError) return scopeError;
		const roleError = await requireOAuthWorkspaceRole(authCtx, authCtx.workspaceId, ["owner", "admin"]);
		if (roleError) return roleError;
		if (!isThirdPartyOAuthEnabled()) return thirdPartyOAuthComingSoon();

		const clientId = c.req.param("clientId");

		// Fetch OAuth app metadata and attach derived stats
		const app = await findOAuthAppWithStats(clientId, authCtx.workspaceId);
		if (!app) {
			return c.json({ error: "OAuth app not found" }, 404);
		}

		return c.json(serializeOAuthClientRecord(app as Record<string, unknown>));
	} catch (error: any) {
		console.error("Error fetching OAuth client:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * PATCH /v1/oauth-clients/:clientId
 *
 * Update an OAuth app's metadata
 */
app.patch("/:clientId", async (c) => {
	try {
		const authCtx = readAuthContext(c.get("ctx"));
		if (!authCtx.workspaceId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const scopeError = requireCapability(authCtx, CAPABILITIES.OAUTH_CLIENTS_WRITE);
		if (scopeError) return scopeError;
		const roleError = await requireOAuthWorkspaceRole(authCtx, authCtx.workspaceId, ["owner", "admin"]);
		if (roleError) return roleError;
		if (!isThirdPartyOAuthEnabled()) return thirdPartyOAuthComingSoon();

		const clientId = c.req.param("clientId");

		// Parse and validate input
		const body = await c.req.json();
		const parsed = updateOAuthClientSchema.safeParse(body);

		if (!parsed.success) {
			return c.json(
				{
					error: "Validation error",
					details: parsed.error.issues,
				},
				400
			);
		}

		const updates = parsed.data;
		const allowedScopes =
			updates.allowed_scopes === undefined
				? { ok: true as const, value: undefined }
				: resolveAllowedScopes(updates.allowed_scopes, []);
		if (allowedScopes.ok === false) {
			return c.json({ error: allowedScopes.message }, 400);
		}

		const existingApp = await findOwnedOAuthApp(clientId, authCtx.workspaceId);
		if (!existingApp) {
			return c.json({ error: "OAuth app not found" }, 404);
		}

		// Update metadata in database
		const metadataUpdates = {
			name: updates.name,
			description: updates.description,
			homepageUrl: updates.homepage_url,
			logoUrl: updates.logo_url,
			privacyPolicyUrl: updates.privacy_policy_url,
			termsOfServiceUrl: updates.terms_of_service_url,
			redirectUris: updates.redirect_uris,
			allowedScopes: allowedScopes.value,
		};
		const updated = await updateOAuthAppMetadata(clientId, authCtx.workspaceId, metadataUpdates);
		if (!updated) {
			return c.json({ error: "Failed to update OAuth app" }, 500);
		}

		return c.json(serializeOAuthClientRecord(updated as Record<string, unknown>));
	} catch (error: any) {
		console.error("Error updating OAuth client:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * DELETE /v1/oauth-clients/:clientId
 *
 * Delete an OAuth app (revokes all authorizations)
 */
app.delete("/:clientId", async (c) => {
	try {
		const authCtx = readAuthContext(c.get("ctx"));
		if (!authCtx.workspaceId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const scopeError = requireCapability(authCtx, CAPABILITIES.OAUTH_CLIENTS_DELETE);
		if (scopeError) return scopeError;
		const roleError = await requireOAuthWorkspaceRole(authCtx, authCtx.workspaceId, ["owner", "admin"]);
		if (roleError) return roleError;
		if (!isThirdPartyOAuthEnabled()) return thirdPartyOAuthComingSoon();

		const clientId = c.req.param("clientId");

		if (!(await deleteOAuthAppAndRevokeAuthorizations(clientId, authCtx.workspaceId))) {
			return c.json({ error: "OAuth app not found" }, 404);
		}

		return c.json({
			message: "OAuth app deleted successfully",
			client_id: clientId,
		});
	} catch (error: any) {
		console.error("Error deleting OAuth client:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * POST /v1/oauth-clients/:clientId/regenerate-secret
 *
 * Regenerate the client secret (invalidates old one)
 */
app.post("/:clientId/regenerate-secret", async (c) => {
	try {
		const authCtx = readAuthContext(c.get("ctx"));
		if (!authCtx.workspaceId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const scopeError = requireCapability(authCtx, CAPABILITIES.OAUTH_CLIENTS_WRITE);
		if (scopeError) return scopeError;
		const roleError = await requireOAuthWorkspaceRole(authCtx, authCtx.workspaceId, ["owner", "admin"]);
		if (roleError) return roleError;
		if (!isThirdPartyOAuthEnabled()) return thirdPartyOAuthComingSoon();

		const clientId = c.req.param("clientId");

		const ownedApp = await findOwnedOAuthApp(clientId, authCtx.workspaceId);
		if (!ownedApp) {
			return c.json({ error: "OAuth app not found" }, 404);
		}
		if (ownedApp.client_type !== "confidential") {
			return c.json({ error: "Public OAuth apps do not use client secrets" }, 400);
		}

		const nextSecret = createOpaqueCode();
		const nextSecretHash = await hashOAuthClientSecret(nextSecret);
		if (!(await updateOAuthAppMetadata(clientId, authCtx.workspaceId, { clientSecretHash: nextSecretHash }))) {
			return c.json({ error: "Failed to regenerate secret" }, 500);
		}

		return c.json({
			client_id: clientId,
			client_secret: nextSecret, // Only returned once!
			message: "Client secret regenerated successfully",
		});
	} catch (error: any) {
		console.error("Error regenerating secret:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

export default app;
