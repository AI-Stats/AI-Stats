import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { requireAccountWorkspace } from "./context";
import { createOAuthApp, deleteOAuthApp, findOAuthApp, updateOAuthApp } from "@/repositories/oauth-apps";

const SUPPORTED_SCOPES = new Set([
	"openid", "profile", "email", "me:read", "models:read", "providers:read",
	"pricing:read", "credits:read", "activity:read", "analytics:read",
	"generations:read", "feedback:read", "feedback:write", "workspaces:read", "keys:read", "presets:read",
	"settings:read", "guardrails:read", "management_keys:read", "oauth_clients:read",
	"workspaces:write", "keys:write", "presets:write", "settings:write",
	"guardrails:write", "management_keys:write", "oauth_clients:write",
	"workspaces:delete", "keys:delete", "presets:delete", "guardrails:delete",
	"management_keys:delete", "oauth_clients:delete",
]);

type OAuthBody = {
	name?: string;
	description?: string;
	homepage_url?: string;
	redirect_uris?: string[];
	workspace_id?: string;
	logo_url?: string;
	privacy_policy_url?: string;
	terms_of_service_url?: string;
	allowed_scopes?: string[];
};

function normalizeScopes(value: unknown): string[] {
	if (!Array.isArray(value)) throw new Error("Choose at least one OAuth scope");
	const scopes = [...new Set(value.map((scope) => String(scope).trim()).filter(Boolean))];
	if (!scopes.length) throw new Error("Choose at least one OAuth scope");
	const unsupported = scopes.find((scope) => !SUPPORTED_SCOPES.has(scope));
	if (unsupported) throw new Error(`Unsupported OAuth scope: ${unsupported}`);
	return scopes;
}

function validateRedirectUris(value: unknown): string[] {
	if (!Array.isArray(value) || value.length === 0) throw new Error("At least one redirect URI is required");
	return value.map((entry) => {
		const uri = String(entry).trim();
		let url: URL;
		try { url = new URL(uri); } catch { throw new Error(`Invalid redirect URI format: ${uri}`); }
		const loopback = ["127.0.0.1", "::1", "[::1]", "localhost"].includes(url.hostname);
		if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
			throw new Error(`Invalid redirect URI: ${uri}`);
		}
		return uri;
	});
}

function validateMetadataUrls(body: OAuthBody): void {
	for (const field of ["homepage_url", "logo_url", "privacy_policy_url", "terms_of_service_url"] as const) {
		const value = body[field]?.trim();
		if (!value) continue;
		let url: URL;
		try { url = new URL(value); } catch { throw new Error(`${field.replaceAll("_", " ")} must be a valid HTTPS URL`); }
		if (url.protocol !== "https:" || url.username || url.password || url.hash) {
			throw new Error(`${field.replaceAll("_", " ")} must be an HTTPS URL without credentials or a fragment`);
		}
	}
}

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function createOAuthCredential() {
	return {
		client_id: crypto.randomUUID(),
		client_secret: base64Url(crypto.getRandomValues(new Uint8Array(32))),
	};
}

async function hashSecret(env: Env, secret: string): Promise<string> {
	const pepper = String(env.PHASEO_OAUTH_TOKEN_PEPPER ?? env.KEY_PEPPER_ACTIVE ?? "").trim();
	if (!pepper) throw new Error("OAuth token pepper is not configured");
	const iterations = 600_000;
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const material = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const hash = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", iterations, salt: new TextEncoder().encode(`${pepper}:${base64Url(salt)}`) },
		material,
		256,
	);
	return `pbkdf2-sha256$${iterations}$${base64Url(salt)}$${base64Url(new Uint8Array(hash))}`;
}

async function appContext(request: Request, env: Env, clientId: string) {
	const app = await findOAuthApp(env, clientId);
	if (!app?.workspaceId) return null;
	const context = await requireAccountWorkspace({ request, env, workspaceId: app.workspaceId });
	if (!context || !["owner", "admin"].includes(context.role.toLowerCase())) return null;
	return { app, context };
}

function failure(c: any, error: unknown, status: 400 | 409 | 503 = 400) {
	return c.json({ error: error instanceof Error ? error.message : "OAuth app operation failed" }, status, PRIVATE_NO_STORE_HEADERS);
}

export const accountSettingsOAuthRouter = new Hono<{ Bindings: Env }>();

accountSettingsOAuthRouter.post("/oauth-apps", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "Unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: OAuthBody = await c.req.json<OAuthBody>().catch(() => ({}));
	const name = body.name?.trim() ?? "";
	if (name.length < 3) return c.json({ error: "App name must be at least 3 characters" }, 400, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: body.workspace_id });
	if (!context || !["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "Workspace owner or admin access is required to create OAuth apps" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const redirectUris = validateRedirectUris(body.redirect_uris);
		validateMetadataUrls(body);
		const allowedScopes = normalizeScopes(body.allowed_scopes);
		const created = createOAuthCredential();
		const metadata = await createOAuthApp(c.env, {
			clientId: created.client_id,
			workspaceId: context.workspaceId,
			name,
			description: body.description,
			redirectUris,
			homepageUrl: body.homepage_url,
			logoUrl: body.logo_url,
			privacyPolicyUrl: body.privacy_policy_url,
			termsOfServiceUrl: body.terms_of_service_url,
			clientType: "confidential",
			clientSecretHash: await hashSecret(c.env, created.client_secret),
			allowedScopes,
			createdBy: user.id,
			status: "active",
		});
		return c.json({ data: { ...metadata, client_secret: created.client_secret } }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) { return failure(c, error); }
});

accountSettingsOAuthRouter.put("/oauth-apps/:clientId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "Unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const loaded = await appContext(c.req.raw, c.env, c.req.param("clientId"));
	if (!loaded) return c.json({ error: "Workspace owner or admin access is required" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: OAuthBody & { operation?: string } = await c.req
		.json<OAuthBody & { operation?: string }>()
		.catch(() => ({}));
	try {
		if (body.operation === "redirect-uris") {
			const redirectUris = validateRedirectUris(body.redirect_uris);
			await updateOAuthApp(c.env, loaded.app.clientId, loaded.context.workspaceId, { redirectUris });
			return c.json({ data: { redirect_uris: redirectUris } }, 200, PRIVATE_NO_STORE_HEADERS);
		}
		const update: Parameters<typeof updateOAuthApp>[3] = {};
		if (body.name !== undefined) update.name = body.name;
		if (body.description !== undefined) update.description = body.description;
		if (body.homepage_url !== undefined) update.homepageUrl = body.homepage_url;
		if (body.logo_url !== undefined) update.logoUrl = body.logo_url;
		if (body.privacy_policy_url !== undefined) update.privacyPolicyUrl = body.privacy_policy_url;
		if (body.terms_of_service_url !== undefined) update.termsOfServiceUrl = body.terms_of_service_url;
		if (body.allowed_scopes !== undefined) update.allowedScopes = normalizeScopes(body.allowed_scopes);
		validateMetadataUrls(body);
		return c.json({ data: await updateOAuthApp(c.env, loaded.app.clientId, loaded.context.workspaceId, update) }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) { return failure(c, error); }
});

accountSettingsOAuthRouter.post("/oauth-apps/:clientId/regenerate-secret", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "Unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const loaded = await appContext(c.req.raw, c.env, c.req.param("clientId"));
	if (!loaded) return c.json({ error: "Workspace owner or admin access is required" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const clientSecret = createOAuthCredential().client_secret;
		await updateOAuthApp(c.env, loaded.app.clientId, loaded.context.workspaceId, { clientSecretHash: await hashSecret(c.env, clientSecret) });
		return c.json({ data: { client_id: loaded.app.clientId, client_secret: clientSecret } }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) { return failure(c, error, 503); }
});

accountSettingsOAuthRouter.delete("/oauth-apps/:clientId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "Unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const loaded = await appContext(c.req.raw, c.env, c.req.param("clientId"));
	if (!loaded) return c.json({ error: "Workspace owner or admin access is required" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { await deleteOAuthApp(c.env, loaded.app.clientId, loaded.context.workspaceId); } catch (error) { return failure(c, error, 503); }
	return c.json({ data: { success: true } }, 200, PRIVATE_NO_STORE_HEADERS);
});
