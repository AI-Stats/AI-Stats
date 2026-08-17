import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";

vi.mock("@/repositories/teams", async (importOriginal) => ({
	...await importOriginal<Record<string, unknown>>(),
	getTeamsDashboard: vi.fn(async () => ({
		profile: { defaultWorkspaceId: "workspace-1" },
		memberships: [{ workspaceId: "workspace-1", userId: "user-1", role: "admin" }],
		owned: [],
		teams: [{ id: "workspace-1", name: "Team One", publisherHandle: "team-one" }],
		members: [{ workspaceId: "workspace-1", userId: "user-1", role: "admin", displayName: "Test User" }],
		invites: [{ invite: { id: "invite-1", workspaceId: "workspace-1", creatorUserId: "user-1" }, creatorDisplayName: "Test User" }],
		requests: [{ id: "join-1", workspace_id: "workspace-1", requester_user_id: "user-2", status: "pending" }],
		balances: [{ workspaceId: "workspace-1", balanceNanos: 2_500_000_000 }],
		settings: [{ workspaceId: "workspace-1", ssoEnabled: true, ssoEnforced: false, ssoMode: "saml", ssoProviderIdentifier: "provider-1", ssoDomains: ["example.com"] }],
	})),
}));

const env = { ENV: "development" as const };
afterEach(() => vi.unstubAllGlobals());

describe("account teams settings route", () => {
	it("returns only accessible workspace membership, access, billing, and SSO data", async () => {
		const response = await app.request("https://phaseo.app/api/account/settings/teams?workspaceId=workspace-1", { headers: { authorization: "Bearer token" } }, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		await expect(response.json()).resolves.toMatchObject({
			teams: [{ id: "workspace-1", name: "Team One" }],
			membersByTeam: { "workspace-1": [{ user_id: "user-1", display_name: "Test User" }] },
			invitesByTeam: { "workspace-1": [{ id: "invite-1" }] },
			requestsByTeam: { "workspace-1": [{ id: "join-1" }] },
			initialTeamId: "workspace-1",
			currentUserId: "user-1",
			personalTeamId: "workspace-1",
			manageableTeamIds: ["workspace-1"],
			walletBalances: { "workspace-1": 2.5 },
			teamSsoSettingsByTeam: { "workspace-1": { sso_enabled: true, sso_mode: "saml" } },
		});
	});
});
