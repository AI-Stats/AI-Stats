import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	thirdPartyEnabled: false,
	refreshRow: null as Record<string, unknown> | null,
	activeClient: null as Record<string, unknown> | null,
	authorization: { scopes: ["openid"] } as { scopes: string[] } | null,
	insertedRefresh: [] as Array<Record<string, unknown>>,
	grantResult: "invalid" as "issued" | "invalid",
	rotationResult: "invalid" as "rotated" | "reused" | "invalid",
	managedKeyResult: "invalid" as "issued" | "invalid",
	revokedRefreshHashes: [] as string[][],
	revokedKeyIds: [] as string[],
	delegatedKey: null as { id: string; hash: string; keyKind: string; status: string } | null,
}));

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({
		PHASEO_THIRD_PARTY_OAUTH_ENABLED: state.thirdPartyEnabled,
		KEY_PEPPER_ACTIVE: "key-pepper",
		PHASEO_OAUTH_TOKEN_PEPPER_ACTIVE: "oauth-pepper",
		GATEWAY_PUBLIC_BASE_URL: "https://api.phaseo.app",
		NODE_ENV: "test",
	}),
}));

vi.mock("@/runtime/identity", () => ({
	getIdentityUserById: vi.fn(async () => ({
		data: { user: { id: "user_1", email: "user@example.com", name: "Test User", image: null } },
		error: null,
	})),
}));

vi.mock("@/repositories/oauth", () => ({
	findActiveOAuthClient: vi.fn(async () => state.activeClient),
	findOAuthRefreshToken: vi.fn(async () => state.refreshRow),
	findActiveAuthorizationWithMembership: vi.fn(async () => state.authorization),
	insertOAuthRefreshToken: vi.fn(async (input: Record<string, unknown>) => { state.insertedRefresh.push(input); }),
	consumeOAuthGrantAndIssueRefreshToken: vi.fn(async () => state.grantResult),
	rotateOAuthRefreshToken: vi.fn(async () => state.rotationResult),
	consumeOAuthCodeAndIssueDelegatedKey: vi.fn(async () => state.managedKeyResult),
	revokeOAuthRefreshTokens: vi.fn(async (hashes: string[]) => { state.revokedRefreshHashes.push(hashes); }),
	findActiveDelegatedKeyByKid: vi.fn(async () => state.delegatedKey),
	revokeDelegatedKey: vi.fn(async (id: string) => { state.revokedKeyIds.push(id); }),
	upsertOAuthAuthorization: vi.fn(async () => undefined),
}));

import {
	issueOAuthManagedKeyForAuthorizationCode,
	issueTokenPair,
	issueTokenPairForGrant,
	loadOAuthClient,
	revokeToken,
	rotateRefreshToken,
} from "./service";

describe("OAuth service security boundaries", () => {
	beforeEach(() => {
		state.thirdPartyEnabled = false;
		state.refreshRow = null;
		state.activeClient = null;
		state.authorization = { scopes: ["openid"] };
		state.insertedRefresh.length = 0;
		state.grantResult = "invalid";
		state.rotationResult = "invalid";
		state.managedKeyResult = "invalid";
		state.revokedRefreshHashes.length = 0;
		state.revokedKeyIds.length = 0;
		state.delegatedKey = null;
	});

	it("does not query untrusted clients while third-party OAuth is disabled", async () => {
		await expect(loadOAuthClient("third_party")).resolves.toBeNull();
	});

	it("persists a refresh token before returning a token pair", async () => {
		const tokens = await issueTokenPair({
			userId: "user_1", workspaceId: "ws_1", clientId: "phaseo_cli", scopes: ["openid"],
		});
		expect(tokens.refresh_token).toEqual(expect.any(String));
		expect(state.insertedRefresh).toHaveLength(1);
		expect(state.insertedRefresh[0]).toMatchObject({ userId: "user_1", workspaceId: "ws_1", clientId: "phaseo_cli" });
	});

	it("returns grant tokens only after the atomic Drizzle transaction succeeds", async () => {
		const input = { userId: "user_1", workspaceId: "ws_1", clientId: "phaseo_cli", scopes: ["openid"] };
		await expect(issueTokenPairForGrant({ type: "device_code", id: "grant_1" }, input)).resolves.toBeNull();
		state.grantResult = "issued";
		await expect(issueTokenPairForGrant({ type: "device_code", id: "grant_1" }, input)).resolves.toMatchObject({ access_token: expect.any(String) });
	});

	it("returns a rotated pair only after atomic refresh rotation succeeds", async () => {
		state.refreshRow = {
			id: "refresh_1", tokenHash: "stored", userId: "user_1", workspaceId: "ws_1",
			clientId: "phaseo_cli", scopes: ["openid"], expiresAt: "2999-01-01T00:00:00.000Z", revokedAt: null,
		};
		state.activeClient = {
			id: "phaseo_cli", name: "Phaseo CLI", description: null, logoUrl: null, homepageUrl: null,
			clientType: "public", clientSecretHash: null, redirectUris: [], allowedScopes: ["openid"],
			isFirstParty: true, betaStatus: "private", status: "active",
		};
		await expect(rotateRefreshToken("refresh-token")).resolves.toEqual({ ok: false, reason: "invalid_grant" });
		state.rotationResult = "rotated";
		await expect(rotateRefreshToken("refresh-token")).resolves.toMatchObject({ ok: true, tokens: { refresh_token: expect.any(String) } });
	});

	it("issues delegated keys only after the atomic code transaction succeeds", async () => {
		const input = {
			userId: "user_1", workspaceId: "ws_1", clientId: "third_party",
			scopes: ["gateway:access"], resource: "https://api.phaseo.app/v1",
		};
		await expect(issueOAuthManagedKeyForAuthorizationCode("code_1", input)).resolves.toBeNull();
		state.managedKeyResult = "issued";
		await expect(issueOAuthManagedKeyForAuthorizationCode("code_1", input)).resolves.toMatchObject({
			access_token: expect.stringMatching(/^phaseo_v1_sk_/),
		});
	});

	it("verifies possession before revoking a delegated key", async () => {
		const { hmacSecret } = await import("@/routes/auth.helpers");
		const token = "phaseo_v1_sk_ABCDEFGHIJKL_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN";
		state.delegatedKey = {
			id: "key_1", hash: await hmacSecret("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN", "key-pepper"),
			keyKind: "oauth_delegated", status: "active",
		};
		await revokeToken(token);
		expect(state.revokedRefreshHashes).toHaveLength(1);
		expect(state.revokedKeyIds).toEqual(["key_1"]);
	});
});
