import { getBindings } from "@/runtime/env";
import { getIdentityUserById } from "@/runtime/identity";
import {
	CAPABILITIES,
	DEFAULT_CLI_OAUTH_CAPABILITIES,
	GATEWAY_ACCESS_SCOPE,
	IDENTITY_SCOPES,
	parseStoredScopeList,
} from "@/lib/authz/capabilities";
import { resolveActiveKeyPepper, resolveKeyPepperCandidates } from "@/lib/security/keyPepper";
import { generateGatewayKey, hmacSecret, timingSafeEqual } from "@/routes/auth.helpers";
import { validateOAuthToken, type JWTClaims } from "./jwt";
import {
	findActiveDelegatedKeyByKid,
	findActiveAuthorizationWithMembership,
	findActiveOAuthClient,
	findOAuthRefreshToken,
	insertOAuthRefreshToken,
	consumeOAuthGrantAndIssueRefreshToken,
	consumeOAuthCodeAndIssueDelegatedKey,
	revokeDelegatedKey,
	revokeOAuthRefreshTokens,
	rotateOAuthRefreshToken as rotateStoredOAuthRefreshToken,
	upsertOAuthAuthorization,
} from "@/repositories/oauth";

const encoder = new TextEncoder();
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
const DEVICE_CODE_TTL_SECONDS = 10 * 60;
const AUTH_CODE_TTL_SECONDS = 10 * 60;
const DEFAULT_DEVICE_INTERVAL_SECONDS = 5;
const DEFAULT_WEB_BASE_URL = "https://phaseo.app";
const DEFAULT_API_BASE_URL = "https://api.phaseo.app";
const ACCESS_TOKEN_AUDIENCE = "phaseo-api";
const MCP_UPSTREAM_TOKEN_TTL_SECONDS = 5 * 60;
const DELEGATED_ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

export const CLI_CLIENT_ID = "phaseo_cli";
export const LEGACY_CLI_CLIENT_ID = "aistats_cli";
const CLI_CLIENT_IDS = new Set([CLI_CLIENT_ID, LEGACY_CLI_CLIENT_ID]);

export function isFirstPartyCliClient(clientId: string): boolean {
	return CLI_CLIENT_IDS.has(clientId.trim());
}

export const CLI_DEFAULT_SCOPES = DEFAULT_CLI_OAUTH_CAPABILITIES;

type OAuthClient = {
	id: string;
	name: string;
	description?: string | null;
	logo_url?: string | null;
	homepage_url?: string | null;
	client_type: "public" | "confidential";
	client_secret_hash?: string | null;
	redirect_uris: string[];
	allowed_scopes: string[];
	is_first_party: boolean;
	beta_status: "private" | "beta" | "public";
	status: string;
	registration_source: "first_party" | "dynamic" | "developer" | "cimd";
};

const CIMD_MAX_CLIENT_ID_LENGTH = 2048;
const CIMD_MAX_DOCUMENT_BYTES = 5 * 1024;
const CIMD_FETCH_TIMEOUT_MS = 10_000;
const CIMD_CACHE_TTL_MS = 60 * 60 * 1000;
const CIMD_DEFAULT_SCOPES = [
	...IDENTITY_SCOPES,
	GATEWAY_ACCESS_SCOPE,
	CAPABILITIES.MODELS_READ,
	CAPABILITIES.PROVIDERS_READ,
	CAPABILITIES.PRICING_READ,
	CAPABILITIES.CREDITS_READ,
	CAPABILITIES.ACTIVITY_READ,
	CAPABILITIES.ANALYTICS_READ,
	CAPABILITIES.GENERATIONS_READ,
] as const;
const cimdClientCache = new Map<string, { expiresAt: number; client: OAuthClient }>();

export function isReservedOAuthClientName(value: string): boolean {
	return /\b(?:phaseo|ai[\s_-]*stats)\b/i.test(value.normalize("NFKC"));
}

export type OAuthActor = {
	userId: string;
	email?: string | null;
	name?: string | null;
};

type TokenIssueInput = {
	userId: string;
	workspaceId: string;
	clientId: string;
	scopes: string[];
	resource?: string | null;
	email?: string | null;
	name?: string | null;
};

let ephemeralSigningKey:
	| {
			privateKey: CryptoKey;
			publicJwk: JsonWebKey;
			kid: string;
	  }
	| null = null;

function base64UrlEncodeBytes(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(value: string): string {
	return base64UrlEncodeBytes(encoder.encode(value));
}

function base64UrlDecodeBytes(value: string): Uint8Array {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
	return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function randomBase64Url(byteLength: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	return base64UrlEncodeBytes(bytes);
}

export function getApiBaseUrl(): string {
	const bindings = getBindings();
	return String(bindings.GATEWAY_PUBLIC_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function getGatewayOAuthResource(): string {
	const baseUrl = getApiBaseUrl();
	return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function normalizeOAuthResource(value: string): string | null {
	try {
		const url = new URL(value);
		url.pathname = url.pathname.replace(/\/+$/, "") || "/";
		return url.toString();
	} catch {
		return null;
	}
}

export function isGatewayOAuthResource(resource: string | null | undefined): boolean {
	if (!resource) return false;
	return normalizeOAuthResource(resource) === normalizeOAuthResource(getGatewayOAuthResource());
}

export function getWebBaseUrl(): string {
	const bindings = getBindings();
	return String(bindings.PHASEO_WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL).replace(/\/+$/, "");
}

export function getIssuer(): string {
	return `${getApiBaseUrl()}/oauth`;
}

export function isThirdPartyOAuthEnabled(): boolean {
	const bindings = getBindings();
	const raw = bindings.PHASEO_THIRD_PARTY_OAUTH_ENABLED;
	if (typeof raw === "boolean") return raw;
	return TRUTHY_VALUES.has(String(raw ?? "").trim().toLowerCase());
}

export function isOAuthClientUsable(clientId: string): boolean {
	return isFirstPartyCliClient(clientId) || isThirdPartyOAuthEnabled();
}

export function normalizeScopes(raw: unknown, fallback: readonly string[] = []): string[] {
	const input = Array.isArray(raw)
		? raw
		: typeof raw === "string"
			? raw.split(/[,\s]+/)
			: fallback;
	return Array.from(
		new Set(
			input
				.map((scope) => String(scope).trim())
				.filter(Boolean),
		),
	);
}

export function parseTokenRequestBody(raw: string, contentType: string | null): Record<string, unknown> {
	if (contentType?.toLowerCase().includes("application/json")) {
		return raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
	}
	const params = new URLSearchParams(raw);
	const out: Record<string, string> = {};
	for (const [key, value] of params.entries()) out[key] = value;
	return out;
}

async function sha256Base64Url(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return base64UrlEncodeBytes(new Uint8Array(digest));
}

function resolveOAuthTokenPeppers(): string[] {
	const bindings = getBindings();
	const active = String(bindings.PHASEO_OAUTH_TOKEN_PEPPER_ACTIVE ?? "").trim();
	if (!active) {
		throw new Error("PHASEO_OAUTH_TOKEN_PEPPER_ACTIVE is not configured");
	}
	const previous = String(bindings.PHASEO_OAUTH_TOKEN_PEPPER_PREVIOUS ?? "").trim();
	return previous && previous !== active ? [active, previous] : [active];
}

export async function hashOAuthSecret(value: string): Promise<string> {
	const [active] = resolveOAuthTokenPeppers();
	return sha256Base64Url(`${active}:${value}`);
}

export async function hashOAuthSecretCandidates(value: string): Promise<string[]> {
	return Promise.all(resolveOAuthTokenPeppers().map((pepper) => sha256Base64Url(`${pepper}:${value}`)));
}

export async function hashOAuthClientSecret(value: string): Promise<string> {
	// OAuth client secrets are generated opaque values, not user-chosen passwords.
	// A peppered SHA-256 hash therefore retains the required secret-at-rest and
	// rotation properties without consuming a Worker CPU budget on every client
	// registration or token exchange. verifyClientSecret still accepts legacy
	// PBKDF2 records so this format change is backwards compatible.
	return hashOAuthSecret(value);
}

async function verifyPbkdf2OAuthClientSecret(value: string, stored: string): Promise<boolean> {
	const [, rawIterations, salt, expected] = stored.split("$");
	const iterations = Number(rawIterations);
	if (!Number.isSafeInteger(iterations) || iterations < 100_000 || !salt || !expected) return false;
	const key = await crypto.subtle.importKey("raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]);
	const candidates = await Promise.all(resolveOAuthTokenPeppers().map(async (pepper) => {
		const bits = await crypto.subtle.deriveBits(
			{ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(`${pepper}:${salt}`), iterations },
			key,
			256,
		);
		return base64UrlEncodeBytes(new Uint8Array(bits));
	}));
	return candidates.some((candidate) => timingSafeEqual(candidate, expected));
}

export async function verifyClientSecret(
	client: Pick<OAuthClient, "client_type" | "client_secret_hash">,
	providedSecret: string | null | undefined,
): Promise<boolean> {
	if (client.client_type !== "confidential") return true;
	const normalizedSecret = String(providedSecret ?? "").trim();
	if (!normalizedSecret || !client.client_secret_hash) return false;
	if (client.client_secret_hash.startsWith("pbkdf2-sha256$")) {
		return verifyPbkdf2OAuthClientSecret(normalizedSecret, client.client_secret_hash);
	}
	const candidates = await hashOAuthSecretCandidates(normalizedSecret);
	return candidates.some((candidate) => timingSafeEqual(candidate, client.client_secret_hash as string));
}

export function createUserCode(): string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let out = "";
	const maxUnbiasedByte = Math.floor(256 / alphabet.length) * alphabet.length;
	while (out.length < 8) {
		const chunk = crypto.getRandomValues(new Uint8Array(8));
		for (const byte of chunk) {
			if (byte >= maxUnbiasedByte) continue;
			out += alphabet[byte % alphabet.length];
			if (out.length === 8) break;
		}
	}
	return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function normalizeUserCode(value: string): string {
	return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.+)$/, "$1-$2");
}

async function importPrivateJwk(jwk: JsonWebKey): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
}

function publicJwkFromPrivate(jwk: JsonWebKey): JsonWebKey {
	const { d, p, q, dp, dq, qi, oth, key_ops, ...publicJwk } = jwk as any;
	return {
		...publicJwk,
		kid: (jwk as any).kid ?? "phaseo-oauth-v1",
		alg: "RS256",
		use: "sig",
		key_ops: ["verify"],
	} as JsonWebKey;
}

async function getSigningMaterial() {
	const bindings = getBindings();
	const rawJwk = String(bindings.PHASEO_OAUTH_PRIVATE_JWK ?? "").trim();
	if (rawJwk) {
		const jwk = JSON.parse(rawJwk) as JsonWebKey;
		return {
			privateKey: await importPrivateJwk(jwk),
			publicJwk: publicJwkFromPrivate(jwk),
			kid: String((jwk as any).kid ?? "phaseo-oauth-v1"),
		};
	}

	if (String(bindings.NODE_ENV ?? "").toLowerCase() === "production") {
		throw new Error("PHASEO_OAUTH_PRIVATE_JWK is required for OAuth token signing");
	}

	if (!ephemeralSigningKey) {
		const keyPair = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);
		const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
		ephemeralSigningKey = {
			privateKey: keyPair.privateKey,
			publicJwk: {
				...publicJwk,
				kid: "phaseo-oauth-dev",
				alg: "RS256",
				use: "sig",
				key_ops: ["verify"],
			} as JsonWebKey,
			kid: "phaseo-oauth-dev",
		};
	}

	return ephemeralSigningKey;
}

export async function getLocalJwks(): Promise<{ keys: JsonWebKey[] }> {
	const material = await getSigningMaterial();
	return { keys: [material.publicJwk] };
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
	const material = await getSigningMaterial();
	const header = {
		alg: "RS256",
		typ: "JWT",
		kid: material.kid,
	};
	const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
	const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const signature = await crypto.subtle.sign(
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		material.privateKey,
		encoder.encode(signingInput),
	);
	return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

export async function validateLocalAccessToken(token: string) {
	const jwks = await getLocalJwks();
	return validateOAuthToken(token, jwks.keys, getIssuer(), ACCESS_TOKEN_AUDIENCE);
}

export async function issueMcpUpstreamToken(input: TokenIssueInput) {
	const now = Math.floor(Date.now() / 1000);
	return {
		access_token: await signJwt({
			iss: getIssuer(),
			sub: input.userId,
			aud: ACCESS_TOKEN_AUDIENCE,
			exp: now + MCP_UPSTREAM_TOKEN_TTL_SECONDS,
			iat: now,
			jti: crypto.randomUUID(),
			user_id: input.userId,
			workspace_id: input.workspaceId,
			client_id: input.clientId,
			scope: input.scopes.join(" "),
		}),
		token_type: "Bearer" as const,
		expires_in: MCP_UPSTREAM_TOKEN_TTL_SECONDS,
		scope: input.scopes.join(" "),
	};
}

async function fetchUserProfile(userId: string): Promise<{ email?: string | null; name?: string | null }> {
	const { data } = await getIdentityUserById(userId);
	const user = data?.user;
	return {
		email: user?.email ?? null,
		name: user?.name ?? null,
	};
}

export async function getOAuthRequestActor(request: Request): Promise<OAuthActor | null> {
	const bindings = getBindings();
	const cookie = request.headers.get("cookie")?.trim();
	const authorization = request.headers.get("authorization")?.trim();
	const configured = String(bindings.BETTER_AUTH_URL ?? "").trim();
	if ((!cookie && !authorization?.startsWith("Bearer ")) || !configured) return null;
	try {
		const sessionUrl = new URL(configured);
		if (sessionUrl.protocol !== "https:" && sessionUrl.hostname !== "localhost") return null;
		sessionUrl.pathname = `${sessionUrl.pathname.replace(/\/+$/, "")}/api/auth/get-session`;
		sessionUrl.search = "";
		sessionUrl.hash = "";
		const response = await fetch(sessionUrl, {
			headers: {
				Accept: "application/json",
				...(cookie ? { Cookie: cookie } : {}),
				...(authorization ? { Authorization: authorization } : {}),
			},
			redirect: "error",
			signal: AbortSignal.timeout(3_000),
		});
		if (!response.ok) return null;
		const payload = await response.json<{
			user?: { id?: string; email?: string | null; name?: string | null; mfaReenrollmentRequired?: boolean };
		}>();
		if (!payload.user?.id || payload.user.mfaReenrollmentRequired === true) return null;
		return {
			userId: payload.user.id,
			email: payload.user.email ?? null,
			name: payload.user.name ?? null,
		};
	} catch {
		return null;
	}
}

function parseCimdClientId(clientId: string): URL | null {
	if (!clientId || clientId.length > CIMD_MAX_CLIENT_ID_LENGTH) return null;
	try {
		const url = new URL(clientId);
		if (
			url.protocol !== "https:"
			|| url.username
			|| url.password
			|| url.hash
			|| url.pathname === "/"
		) return null;
		return url;
	} catch {
		return null;
	}
}

function isCimdRedirectUri(value: unknown): value is string {
	if (typeof value !== "string" || value.length > 2048) return false;
	try {
		const url = new URL(value);
		if (url.hash || url.username || url.password) return false;
		if (url.protocol === "https:") return true;
		return url.protocol === "http:"
			&& (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1" || url.hostname === "[::1]");
	} catch {
		return false;
	}
}

function optionalHttpsMetadataUrl(value: unknown): string | null | undefined {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string" || value.length > 2048) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password && !url.hash
			? url.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

async function readResponseTextWithinLimit(response: Response, maximumBytes: number): Promise<string | null> {
	if (!response.body) return "";
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		totalBytes += value.byteLength;
		if (totalBytes > maximumBytes) {
			await reader.cancel().catch(() => undefined);
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

async function loadCimdClient(clientId: string): Promise<OAuthClient | null> {
	const clientUrl = parseCimdClientId(clientId);
	if (!clientUrl) return null;
	const cached = cimdClientCache.get(clientId);
	if (cached && cached.expiresAt > Date.now()) return cached.client;

	let response: Response;
	try {
		response = await fetch(clientUrl, {
			headers: { Accept: "application/json" },
			redirect: "error",
			signal: AbortSignal.timeout(CIMD_FETCH_TIMEOUT_MS),
		});
	} catch {
		return null;
	}
	if (!response.ok) return null;
	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > CIMD_MAX_DOCUMENT_BYTES) return null;
	const text = await readResponseTextWithinLimit(response, CIMD_MAX_DOCUMENT_BYTES);
	if (text === null) return null;

	let parsedMetadata: unknown;
	try {
		parsedMetadata = JSON.parse(text);
	} catch {
		return null;
	}
	if (!parsedMetadata || typeof parsedMetadata !== "object" || Array.isArray(parsedMetadata)) return null;
	const metadata = parsedMetadata as Record<string, unknown>;
	if (metadata.client_id !== clientId) return null;
	const name = typeof metadata.client_name === "string" ? metadata.client_name.normalize("NFKC").trim() : "";
	const redirectUris = Array.isArray(metadata.redirect_uris) ? metadata.redirect_uris : [];
	const clientUri = optionalHttpsMetadataUrl(metadata.client_uri);
	const logoUri = optionalHttpsMetadataUrl(metadata.logo_uri);
	if (
		name.length < 1
		|| name.length > 100
		|| /[\u0000-\u001f\u007f]/.test(name)
		|| isReservedOAuthClientName(name)
		|| redirectUris.length < 1
		|| redirectUris.length > 10
		|| !redirectUris.every(isCimdRedirectUri)
		|| clientUri === undefined
		|| logoUri === undefined
		|| String(metadata.token_endpoint_auth_method ?? "none") !== "none"
	) return null;
	const responseTypes = Array.isArray(metadata.response_types) ? metadata.response_types.map(String) : ["code"];
	const grantTypes = Array.isArray(metadata.grant_types) ? metadata.grant_types.map(String) : ["authorization_code"];
	if (
		!responseTypes.every((value) => value === "code")
		|| !grantTypes.includes("authorization_code")
		|| !grantTypes.every((value) => value === "authorization_code" || value === "refresh_token")
	) return null;
	const requestedScopes = normalizeScopes(metadata.scope, CIMD_DEFAULT_SCOPES);
	const allowedScopeSet = new Set<string>(CIMD_DEFAULT_SCOPES);
	const allowedScopes = requestedScopes.filter((scope) => allowedScopeSet.has(scope));
	if (allowedScopes.length === 0) return null;

	const client: OAuthClient = {
		id: clientId,
		name,
		description: null,
		logo_url: logoUri,
		homepage_url: clientUri,
		client_type: "public",
		client_secret_hash: null,
		redirect_uris: Array.from(new Set(redirectUris as string[])),
		allowed_scopes: allowedScopes,
		is_first_party: false,
		beta_status: "public",
		status: "active",
		registration_source: "cimd",
	};
	cimdClientCache.set(clientId, { expiresAt: Date.now() + CIMD_CACHE_TTL_MS, client });
	return client;
}

export async function loadOAuthClient(clientId: string): Promise<OAuthClient | null> {
	const id = clientId.trim();
	if (!id) return null;
	if (!isOAuthClientUsable(id)) return null;
	const lookupId = id === LEGACY_CLI_CLIENT_ID ? CLI_CLIENT_ID : id;
	const row = await findActiveOAuthClient(lookupId);
	if (!row) return loadCimdClient(id);
	return {
		id: id === LEGACY_CLI_CLIENT_ID ? LEGACY_CLI_CLIENT_ID : row.id,
		name: row.name,
		description: row.description ?? null,
		logo_url: row.logoUrl ?? null,
		homepage_url: row.homepageUrl ?? null,
		client_type: row.clientType === "confidential" ? "confidential" : "public",
		client_secret_hash: row.clientSecretHash ?? null,
		redirect_uris: row.redirectUris,
		allowed_scopes: row.allowedScopes,
		is_first_party: row.isFirstParty,
		beta_status: row.betaStatus === "public" || row.betaStatus === "beta" ? row.betaStatus : "private",
		status: row.status ?? "active",
		registration_source: row.isFirstParty ? "first_party" : "developer",
	};
}

export function filterAllowedScopes(client: OAuthClient, requested: string[]): string[] {
	const allowed = new Set(parseStoredScopeList(client.allowed_scopes));
	return requested.filter((scope) => allowed.has(scope));
}

function isCliLoopbackRedirectUri(client: OAuthClient, redirectUri: string): boolean {
	if (!CLI_CLIENT_IDS.has(client.id)) return false;
	try {
		const url = new URL(redirectUri);
		return (
			url.protocol === "http:" &&
			(url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1" || url.hostname === "[::1]") &&
			url.pathname === "/callback" &&
			!url.username &&
			!url.password &&
			!url.search &&
			!url.hash
		);
	} catch {
		return false;
	}
}

export function assertRedirectAllowed(client: OAuthClient, redirectUri: string): boolean {
	return client.redirect_uris.some((uri) => uri === redirectUri) || isCliLoopbackRedirectUri(client, redirectUri);
}

export async function ensureGrant(args: {
	userId: string;
	workspaceId: string;
	clientId: string;
	scopes: string[];
}) {
	await upsertOAuthAuthorization(args);
}

export async function getActiveOAuthWorkspaceScopes(args: {
	userId: string;
	workspaceId: string;
	clientId: string;
}): Promise<string[] | null> {
	const authorization = await findActiveAuthorizationWithMembership(args);
	return authorization ? authorization.scopes.map(String).filter(Boolean) : null;
}

export async function hasActiveOAuthWorkspaceAccess(args: {
	userId: string;
	workspaceId: string;
	clientId: string;
}): Promise<boolean> {
	return (await getActiveOAuthWorkspaceScopes(args)) !== null;
}

async function createTokenPairMaterial(input: TokenIssueInput) {
	const profile =
		input.email || input.name
			? { email: input.email ?? null, name: input.name ?? null }
			: await fetchUserProfile(input.userId);
	const now = Math.floor(Date.now() / 1000);
	const accessToken = await signJwt({
		iss: getIssuer(),
		sub: input.userId,
		aud: ACCESS_TOKEN_AUDIENCE,
		exp: now + ACCESS_TOKEN_TTL_SECONDS,
		iat: now,
		jti: crypto.randomUUID(),
		user_id: input.userId,
		workspace_id: input.workspaceId,
		client_id: input.clientId,
		scope: input.scopes.join(" "),
		email: profile.email ?? undefined,
		name: profile.name ?? undefined,
	});

	const refreshToken = randomBase64Url(48);
	const refreshHash = await hashOAuthSecret(refreshToken);
	const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();
	return {
		response: {
			access_token: accessToken,
			token_type: "Bearer",
			expires_in: ACCESS_TOKEN_TTL_SECONDS,
			refresh_token: refreshToken,
			scope: input.scopes.join(" "),
		},
		refreshHash,
		refreshExpiresAt,
	};
}

export async function issueTokenPair(input: TokenIssueInput) {
	const material = await createTokenPairMaterial(input);
	await insertOAuthRefreshToken({
		tokenHash: material.refreshHash,
		userId: input.userId,
		workspaceId: input.workspaceId,
		clientId: input.clientId,
		scopes: input.scopes,
		expiresAt: material.refreshExpiresAt,
		familyId: crypto.randomUUID(),
	});

	return material.response;
}

export async function issueTokenPairForGrant(
	grant: { type: "device_code" | "authorization_code"; id: string },
	input: TokenIssueInput,
) {
	const material = await createTokenPairMaterial(input);
	const result = await consumeOAuthGrantAndIssueRefreshToken({
		grantType: grant.type,
		grantId: grant.id,
		tokenHash: material.refreshHash,
		userId: input.userId,
		workspaceId: input.workspaceId,
		clientId: input.clientId,
		scopes: input.scopes,
		expiresAt: material.refreshExpiresAt,
		familyId: crypto.randomUUID(),
	});
	if (result !== "issued") return null;
	return material.response;
}

export async function issueOAuthManagedKeyForAuthorizationCode(
	grantId: string,
	input: TokenIssueInput,
) {
	// Unbound delegated keys can spend workspace credits and require Gateway
	// consent. A key bound to the Gateway API is still a Gateway credential and
	// must carry the same explicit credit-spending permission.
	if ((!input.resource || isGatewayOAuthResource(input.resource)) && !input.scopes.includes(GATEWAY_ACCESS_SCOPE)) {
		return null;
	}

	const pepper = resolveActiveKeyPepper(getBindings());
	if (!pepper) throw new Error("KEY_PEPPER_ACTIVE is not configured");

	const generated = generateGatewayKey();
	const result = await consumeOAuthCodeAndIssueDelegatedKey({
		codeId: grantId,
		keyHash: await hmacSecret(generated.secret, pepper),
		keyKid: generated.kid,
		keyPrefix: generated.prefix,
		keyName: `OAuth: ${input.clientId}`,
		userId: input.userId,
		workspaceId: input.workspaceId,
		clientId: input.clientId,
		scopes: input.scopes,
		resource: input.resource ?? null,
	});
	if (result !== "issued") return null;
	return {
		access_token: generated.plaintext,
		token_type: "Bearer",
		expires_in: DELEGATED_ACCESS_TOKEN_TTL_SECONDS,
		scope: input.scopes.join(" "),
		...(input.resource ? { resource: input.resource } : {}),
	};
}

export async function rotateRefreshToken(
	refreshToken: string,
	clientAuth?: { clientId?: string; clientSecret?: string | null },
): Promise<
	| { ok: true; tokens: Awaited<ReturnType<typeof issueTokenPair>> }
	| { ok: false; reason: "invalid_client" | "invalid_grant" }
> {
	const tokenHashes = await hashOAuthSecretCandidates(refreshToken);
	const data = await findOAuthRefreshToken(tokenHashes);
	if (!data) return { ok: false, reason: "invalid_grant" };
	const tokenHash = String(data.tokenHash ?? "");
	if (!tokenHash) return { ok: false, reason: "invalid_grant" };
	if (data.expiresAt && Date.parse(String(data.expiresAt)) <= Date.now()) {
		return { ok: false, reason: "invalid_grant" };
	}
	const clientId = String(data.clientId ?? "").trim();
	const client = await loadOAuthClient(clientId);
	if (!client) return { ok: false, reason: "invalid_grant" };
	if (clientAuth?.clientId && clientAuth.clientId !== clientId) {
		return { ok: false, reason: "invalid_client" };
	}
	if (client.client_type === "confidential") {
		if (!clientAuth?.clientId || clientAuth.clientId !== clientId) {
			return { ok: false, reason: "invalid_client" };
		}
		if (!(await verifyClientSecret(client, clientAuth.clientSecret))) {
			return { ok: false, reason: "invalid_client" };
		}
	}
	if (data.revokedAt) {
		await rotateStoredOAuthRefreshToken({
			currentTokenHash: tokenHash,
			nextTokenHash: tokenHash,
			nextExpiresAt: new Date().toISOString(),
		});
		return { ok: false, reason: "invalid_grant" };
	}
	const authorization = await findActiveAuthorizationWithMembership({
		userId: data.userId,
		workspaceId: data.workspaceId,
		clientId,
	});
	if (!authorization) {
		return { ok: false, reason: "invalid_grant" };
	}
	const scopes = Array.isArray(authorization.scopes)
		? authorization.scopes.map(String)
		: Array.isArray(data.scopes)
			? data.scopes.map(String)
			: [];
	const material = await createTokenPairMaterial({
		userId: data.userId,
		workspaceId: data.workspaceId,
		clientId,
		scopes,
	});
	const rotation = await rotateStoredOAuthRefreshToken({
		currentTokenHash: tokenHash,
		nextTokenHash: material.refreshHash,
		nextExpiresAt: material.refreshExpiresAt,
	});
	if (rotation !== "rotated") {
		return { ok: false, reason: "invalid_grant" };
	}

	return {
		ok: true,
		tokens: material.response,
	};
}

export async function ensureGrants(args: {
	userId: string;
	workspaceIds: string[];
	clientId: string;
	scopes: string[];
}) {
	const workspaceIds = Array.from(
		new Set(
			args.workspaceIds
				.map((workspaceId) => String(workspaceId ?? "").trim())
				.filter(Boolean),
		),
	);
	for (const workspaceId of workspaceIds) {
		await ensureGrant({
			userId: args.userId,
			workspaceId,
			clientId: args.clientId,
			scopes: args.scopes,
		});
	}
}

export async function revokeToken(token: string) {
	const tokenHashes = await hashOAuthSecretCandidates(token);
	await revokeOAuthRefreshTokens(tokenHashes);

	// Third-party authorization-code grants return an opaque delegated Gateway
	// key as their OAuth access token. RFC 7009 revocation must invalidate that
	// credential too, while proving possession of its secret before changing it.
	const delegatedKey = /^phaseo_v1_sk_([A-Za-z0-9]{12})_([A-Za-z0-9]{40})$/.exec(token);
	if (!delegatedKey) return;
	const [, kid, secret] = delegatedKey;
	const keyRow = await findActiveDelegatedKeyByKid(kid);
	if (!keyRow) return;

	const candidates = resolveKeyPepperCandidates(getBindings());
	const hashes = await Promise.all(candidates.map((candidate) => hmacSecret(secret, candidate.value)));
	if (!hashes.some((candidate) => timingSafeEqual(candidate, String(keyRow.hash ?? "")))) return;

	await revokeDelegatedKey(keyRow.id);
}

export function makeDeviceCodeExpiry(): string {
	return new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1000).toISOString();
}

export function makeAuthCodeExpiry(): string {
	return new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString();
}

export function defaultDeviceIntervalSeconds(): number {
	return DEFAULT_DEVICE_INTERVAL_SECONDS;
}

export function deviceExpiresInSeconds(): number {
	return DEVICE_CODE_TTL_SECONDS;
}

export function createOpaqueCode(): string {
	return randomBase64Url(32);
}

export function isValidPkceChallenge(value: string): boolean {
	return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isValidPkceVerifier(value: string): boolean {
	return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

export async function verifyPkce(args: { codeVerifier: string; codeChallenge: string; method: string }) {
	if (
		args.method !== "S256" ||
		!isValidPkceVerifier(args.codeVerifier) ||
		!isValidPkceChallenge(args.codeChallenge)
	) return false;
	const expected = await sha256Base64Url(args.codeVerifier);
	return expected === args.codeChallenge;
}

export function bearerToken(req: Request): string | null {
	const header = req.headers.get("authorization") ?? "";
	if (!header.toLowerCase().startsWith("bearer ")) return null;
	return header.slice(7).trim() || null;
}

export function claimsScopes(claims: JWTClaims): string[] {
	return normalizeScopes(claims.scope ?? "");
}

export function hasScope(claims: JWTClaims, scope: string): boolean {
	return claimsScopes(claims).includes(scope);
}

export function verificationUriFor(userCode?: string): string {
	const base = `${getWebBaseUrl()}/activate`;
	if (!userCode) return base;
	const url = new URL(base);
	url.searchParams.set("user_code", userCode);
	return url.toString();
}

export function authorizationConsentUrl(params: URLSearchParams): string {
	const url = new URL(`${getWebBaseUrl()}/oauth/consent`);
	params.forEach((value, key) => url.searchParams.set(key, value));
	url.searchParams.set("phaseo_oauth", "1");
	return url.toString();
}

export function decodeBase64UrlJson<T>(value: string): T {
	return JSON.parse(new TextDecoder().decode(base64UrlDecodeBytes(value))) as T;
}
