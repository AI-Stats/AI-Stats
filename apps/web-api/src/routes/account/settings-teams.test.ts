import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";

const env = { ENV: "development" as const, SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key", SUPABASE_SERVICE_ROLE_KEY: "service-role-key" };
afterEach(() => vi.unstubAllGlobals());

describe("account teams settings route", () => {
	it("allows the effective workspace owner to change an existing member role", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(String(input), init);
			const url = request.url;
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "owner-1" }), { status: 200 });
			if (url.includes("/workspaces")) return new Response(JSON.stringify([{ owner_user_id: "owner-1" }]), { status: 200 });
			if (url.includes("workspace_members") && request.method === "PATCH") {
				return new Response(JSON.stringify([{ workspace_id: "workspace-1", user_id: "member-2", role: "admin" }]), { status: 200 });
			}
			if (url.includes("workspace_members") && url.includes("select=user_id")) {
				return new Response(JSON.stringify([{ user_id: "member-2" }]), { status: 200 });
			}
			if (url.includes("workspace_members")) return new Response("[]", { status: 200 });
			return new Response("[]", { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/settings/teams/workspace-1/members/member-2",
			{ method: "PUT", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify({ role: "admin" }) },
			env,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ userId: "member-2", role: "admin", ok: true });
	});

	it("returns not found when a concurrent member removal affects no row", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(String(input), init);
			const url = request.url;
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "owner-1" }), { status: 200 });
			if (url.includes("/workspaces")) return new Response(JSON.stringify([{ owner_user_id: "owner-1" }]), { status: 200 });
			if (url.includes("workspace_members") && request.method === "DELETE") return new Response("[]", { status: 200 });
			if (url.includes("workspace_members") && url.includes("user_id=eq.member-2")) {
				return new Response(JSON.stringify([{ role: "member" }]), { status: 200 });
			}
			if (url.includes("workspace_members")) return new Response("[]", { status: 200 });
			return new Response("[]", { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/settings/teams/workspace-1/members/member-2",
			{ method: "DELETE", headers: { authorization: "Bearer token" } },
			env,
		);

		expect(response.status).toBe(404);
	});

	it("returns only accessible workspace membership, access, billing, and SSO data", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1", created_at: "2025-01-01" }), { status: 200 });
			if (url.includes("/users") && url.includes("default_workspace_id")) return new Response(JSON.stringify([{ default_workspace_id: "workspace-1", role: "user" }]), { status: 200 });
			if (url.includes("/users")) return new Response(JSON.stringify([{ user_id: "user-1", display_name: "Test User" }]), { status: 200 });
			if (url.includes("workspace_members") && url.includes("user_id%2Crole")) return new Response(JSON.stringify([{ workspace_id: "workspace-1", user_id: "user-1", role: "admin" }]), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ workspace_id: "workspace-1", role: "admin" }]), { status: 200 });
			if (url.includes("/workspaces") && url.includes("owner_user_id")) return new Response(JSON.stringify([]), { status: 200 });
			if (url.includes("/workspaces")) return new Response(JSON.stringify([{ id: "workspace-1", name: "Team One" }]), { status: 200 });
			if (url.includes("workspace_invites")) return new Response(JSON.stringify([{ id: "invite-1", workspace_id: "workspace-1", email: "invite@example.com" }]), { status: 200 });
			if (url.includes("workspace_join_requests")) return new Response(JSON.stringify([{ id: "join-1", workspace_id: "workspace-1", requester_user_id: "user-2", status: "pending" }]), { status: 200 });
			if (url.includes("/wallets")) return new Response(JSON.stringify([{ workspace_id: "workspace-1", balance_nanos: 2500000000 }]), { status: 200 });
			if (url.includes("workspace_settings")) return new Response(JSON.stringify([{ workspace_id: "workspace-1", sso_enabled: true, sso_enforced: false, sso_mode: "saml", sso_provider_identifier: "provider-1", sso_domains: ["example.com"] }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));
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
