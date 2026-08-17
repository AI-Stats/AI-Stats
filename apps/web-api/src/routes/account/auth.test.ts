import { afterEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ findIdentityBySessionToken: vi.fn() }));
const account = vi.hoisted(() => ({ getAccountProfile: vi.fn(), listAccountWorkspaces: vi.fn(), listAllWorkspaces: vi.fn(), setDefaultWorkspace: vi.fn(), updateOnboardingProfile: vi.fn() }));
vi.mock("@/repositories/identity", () => identity);
vi.mock("@/repositories/account-auth", () => account);
import app from "@/index";

const env = {
	ENV: "development" as const,
};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("account auth routes", () => {
	it("denies private account access until migrated MFA is re-enrolled", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
			session: { createdAt: "2026-08-14T10:00:00.000Z" },
			user: {
				id: "user-1",
				email: "user@example.com",
				mfaReenrollmentRequired: true,
			},
		})));

		const response = await app.request(
			"https://phaseo.app/api/account/auth/status",
			{ headers: { cookie: "better-auth.session_token=signed-token" } },
			{
				BETTER_AUTH_URL: "https://phaseo.app",
				ENV: "development",
			},
		);
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({ error: "mfa_reenrollment_required" });
	});

	it.each(["status", "header", "statsig"])(
		"returns an anonymous private response for %s",
		async (resource) => {
			const response = await app.request(
				`https://phaseo.app/api/account/auth/${resource}`,
				{},
				{ ENV: "development" },
			);
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
		},
	);

	it("keeps the workspace directory private", async () => {
		const response = await app.request(
			"https://phaseo.app/api/account/auth/workspaces",
			{},
			{ ENV: "development" },
		);
		expect(response.status).toBe(401);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
	});

	it("builds authenticated header data from verified workspace access", async () => {
		identity.findIdentityBySessionToken.mockResolvedValue({ id: "user-1", email: "user@example.com", createdAt: "2026-01-01", userMetadata: { avatar_url: "https://example.com/avatar.png" }, appMetadata: {} });
		account.getAccountProfile.mockResolvedValue({ defaultWorkspaceId: "workspace-1", role: "admin", displayName: "Test User" });
		account.listAccountWorkspaces.mockResolvedValue([{ id: "workspace-1", name: "Personal Workspace", slug: "personal", role: "owner" }]);

		const response = await app.request(
			"https://phaseo.app/api/account/auth/header",
			{
				headers: {
					authorization: "Bearer session-token",
					cookie: "activeWorkspaceId=workspace-1",
				},
			},
			env,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			isLoggedIn: true,
			user: {
				id: "user-1",
				email: "user@example.com",
				displayName: "Test User",
				avatarUrl: "https://example.com/avatar.png",
			},
			teams: [{ id: "workspace-1", name: "Personal Workspace" }],
			currentTeamId: "workspace-1",
			userRole: "admin",
		});
	});

	it("normalizes authenticated Statsig profile flags", async () => {
		identity.findIdentityBySessionToken.mockResolvedValue({ id: "user-1", email: "user@example.com", createdAt: "2026-01-01", userMetadata: {}, appMetadata: {} });
		account.getAccountProfile.mockResolvedValue({ betaOptIn: true, betaFeatures: { models_catalogue_v2: true, invalid: "yes" }, role: "user" });

		const response = await app.request(
			"https://phaseo.app/api/account/auth/statsig",
			{ headers: { authorization: "Bearer session-token" } },
			env,
		);
		await expect(response.json()).resolves.toMatchObject({
			signedIn: true,
			profile: {
				betaOptIn: true,
				betaFeatures: { models_catalogue_v2: true },
			},
		});
	});
});
