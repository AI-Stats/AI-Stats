"use server";

import { apiBaseUrl } from "@/lib/oauth/apiBaseUrl";
import {
	listUserWorkspaceIds,
	revokeUserAuthorization,
} from "@/lib/database/repositories/oauth";
import { headers } from "next/headers";
import { getServerIdentity } from "@/lib/auth/serverIdentity";

/**
 * OAuth Consent Server Actions
 *
 * These actions handle the user consent flow for OAuth authorization.
 * They integrate with Phaseo's OAuth 2.1 server to approve or deny
 * authorization requests.
 */

interface ApproveAuthorizationInput {
	authorization_id?: string;
	client_id?: string;
	workspace_id: string;
	workspace_ids?: string[];
	primary_workspace_id?: string;
	scopes?: string[];
	redirect_uri?: string;
	state?: string;
	code_challenge?: string;
	code_challenge_method?: string;
	resource?: string;
}

interface ConsentResult {
	data?: {
		redirect_url?: string;
		authorization_id?: string;
	};
	error?: string;
}

interface RegisteredOAuthClient {
	client_id: string;
	redirect_uris: string[];
}

async function loadRegisteredOAuthClient(
	authHeaders: HeadersInit,
	clientId: string,
): Promise<RegisteredOAuthClient | null> {
	const response = await fetch(
		`${apiBaseUrl()}/oauth/client-metadata?client_id=${encodeURIComponent(clientId)}`,
		{
			headers: authHeaders,
			cache: "no-store",
		},
	);
	if (!response.ok) return null;
	const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
	if (!payload || String(payload.client_id ?? "") !== clientId) return null;
	return {
		client_id: clientId,
		redirect_uris: Array.isArray(payload.redirect_uris)
			? payload.redirect_uris.filter((value): value is string => typeof value === "string")
			: [],
	};
}

async function gatewayActorHeaders(): Promise<HeadersInit | null> {
	const cookie = (await headers()).get("cookie")?.trim();
	return cookie ? { Cookie: cookie } : null;
}

/**
 * Approve OAuth authorization request
 *
 * This action:
 * 1. Validates user has permission for the team
 * 2. Records authorization in oauth_authorizations table
 * 3. Generates an authorization code via the Phaseo OAuth service
 * 4. Returns redirect URL with code to send user back to app
 */
export async function approveAuthorizationAction(
	input: ApproveAuthorizationInput
): Promise<ConsentResult> {
	try {
		const user = (await getServerIdentity())?.user;
		if (!user) {
			return { error: "Unauthorized" };
		}
		let resolvedClientId = input.client_id?.trim() || null;
		let scopes = (input.scopes ?? []).filter(
			(scope): scope is string => typeof scope === "string" && scope.trim().length > 0
		);

		if (!resolvedClientId) {
			return {
				error:
					"Missing client identifier for OAuth authorization. Please restart the OAuth flow.",
			};
		}

		if (scopes.length === 0) {
			scopes = ["openid", "email", "gateway:access"];
		}

		const selectedWorkspaceIds = Array.from(
			new Set(
				[
					...(Array.isArray(input.workspace_ids) ? input.workspace_ids : []),
					input.primary_workspace_id,
					input.workspace_id,
				]
					.map((workspaceId) => String(workspaceId ?? "").trim())
					.filter(Boolean),
			),
		);
		const primaryWorkspaceId =
			String(input.primary_workspace_id ?? input.workspace_id ?? "").trim() ||
			selectedWorkspaceIds[0] ||
			"";
		if (!primaryWorkspaceId || selectedWorkspaceIds.length === 0) {
			return { error: "Select at least one team to authorize" };
		}
		if (!selectedWorkspaceIds.includes(primaryWorkspaceId)) {
			return { error: "The active team must also be selected for authorization" };
		}

		// Verify user is a member of every selected team
		const grantedWorkspaceIds = new Set(
			await listUserWorkspaceIds(user.id, selectedWorkspaceIds)
		);

		if (
			!selectedWorkspaceIds.every((workspaceId) => grantedWorkspaceIds.has(workspaceId))
		) {
			return {
				error: "You don't have permission to authorize for one or more selected teams",
			};
		}

		const resolvedRedirectUri = input.redirect_uri?.trim() || null;
		if (!resolvedRedirectUri) {
			return {
				error:
					"Missing authorization_id. Please restart the OAuth flow from the client application.",
			};
		}

		const actorHeaders = await gatewayActorHeaders();
		if (!actorHeaders) {
			return { error: "Unauthorized" };
		}
		if (!(await loadRegisteredOAuthClient(actorHeaders, resolvedClientId))) {
			return { error: "OAuth application not found or inactive" };
		}

		const response = await fetch(`${apiBaseUrl()}/oauth/authorize/approve`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...actorHeaders,
			},
			body: JSON.stringify({
				client_id: resolvedClientId,
				workspace_id: primaryWorkspaceId,
				primary_workspace_id: primaryWorkspaceId,
				workspace_ids: selectedWorkspaceIds,
				scopes,
				redirect_uri: resolvedRedirectUri,
				state: input.state,
				code_challenge: input.code_challenge,
				code_challenge_method: input.code_challenge_method,
				resource: input.resource,
			}),
			cache: "no-store",
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok || !payload?.redirect_url) {
			return {
				error: String(
					payload?.error_description ??
						payload?.message ??
						"Failed to finalize OAuth authorization"
				),
			};
		}

		return {
			data: {
				redirect_url: payload.redirect_url,
			},
		};
	} catch {
		const requestId = crypto.randomUUID();
		console.error("oauth_consent_approve_authorization_failed", {
			operation: "approveAuthorizationAction",
			request_id: requestId,
		});
		return { error: `Failed to approve authorization. Reference: ${requestId}` };
	}
}

/**
 * Deny OAuth authorization request
 *
 * This redirects the user back to the app with an error indicating
 * the authorization was denied by the user.
 */
export async function denyAuthorizationAction(input: {
	authorization_id?: string;
	client_id?: string;
	redirect_uri?: string;
	state?: string;
}): Promise<ConsentResult> {
	try {
		const user = (await getServerIdentity())?.user;
		if (!user) return { error: "Unauthorized" };

		const clientId = input.client_id?.trim();
		if (!input.redirect_uri || !clientId) {
			return {
				error:
					"Missing authorization request details. Please restart the OAuth flow from the client application.",
			};
		}

		const actorHeaders = await gatewayActorHeaders();
		if (!actorHeaders) return { error: "Unauthorized" };
		const registeredClient = await loadRegisteredOAuthClient(actorHeaders, clientId);
		const registeredRedirectUris = registeredClient?.redirect_uris ?? [];
		let isCliLoopback = false;
		if (clientId === "phaseo_cli" || clientId === "aistats_cli") {
			try {
				const redirect = new URL(input.redirect_uri);
				isCliLoopback = redirect.protocol === "http:" &&
					["127.0.0.1", "localhost", "::1", "[::1]"].includes(redirect.hostname) &&
					redirect.pathname === "/callback" &&
					!redirect.username && !redirect.password && !redirect.search && !redirect.hash;
			} catch {
				isCliLoopback = false;
			}
		}
		if (!registeredRedirectUris.includes(input.redirect_uri) && !isCliLoopback) {
			return { error: "OAuth client or redirect URI is invalid" };
		}

		// Build redirect URL with error
		const redirectUrl = new URL(input.redirect_uri);
		redirectUrl.searchParams.set("error", "access_denied");
		redirectUrl.searchParams.set(
			"error_description",
			"The user denied the authorization request"
		);
		if (input.state) {
			redirectUrl.searchParams.set("state", input.state);
		}

		return {
			data: {
				redirect_url: redirectUrl.toString(),
			},
		};
	} catch {
		const requestId = crypto.randomUUID();
		console.error("oauth_consent_deny_authorization_failed", {
			operation: "denyAuthorizationAction",
			request_id: requestId,
		});
		return { error: `Failed to deny authorization. Reference: ${requestId}` };
	}
}

/**
 * Revoke an OAuth authorization
 *
 * This marks the authorization as revoked, which will cause
 * subsequent API requests with tokens for this authorization to fail.
 */
export async function revokeAuthorizationAction(
	authorizationId: string
): Promise<ConsentResult> {
	try {
		const user = (await getServerIdentity())?.user;
		if (!user) {
			return { error: "Unauthorized" };
		}

		// Revoke authorization (set revoked_at timestamp)
		await revokeUserAuthorization(authorizationId, user.id);

		return { data: {} };
	} catch {
		const requestId = crypto.randomUUID();
		console.error("oauth_consent_revoke_authorization_failed", {
			operation: "revokeAuthorizationAction",
			request_id: requestId,
		});
		return { error: `Failed to revoke authorization. Reference: ${requestId}` };
	}
}
