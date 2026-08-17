import { afterEach, describe, expect, it, vi } from "vitest";
const profileRepo = vi.hoisted(() => ({ getProfileRecord: vi.fn(), listProfileWorkspaceIds: vi.fn(), listProfileUsageRows: vi.fn(), getProfileModelNames: vi.fn(), listProfileGameResults: vi.fn() }));
vi.mock("@/repositories/account-profile", () => profileRepo);
import app from "@/index";

const env = {
	ENV: "development" as const,
};

afterEach(() => vi.unstubAllGlobals());

describe("account profile settings route", () => {
	it("returns the private profile identity without coupling it to usage queries", async () => {
		profileRepo.getProfileRecord.mockResolvedValue({ profile: { displayName: "Test Person", defaultWorkspaceId: "workspace-1", createdAt: "2025-01-01T00:00:00Z", obfuscateInfo: false, publicProfileEnabled: false, publicProfileSlug: null }, workspaceName: "Test Workspace" });
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({
				id: "user-1",
				email: "person@example.com",
				created_at: "2025-01-01T00:00:00Z",
				user_metadata: { avatar_url: "https://example.com/avatar.png" },
			}), { status: 200 });
			if (url.includes("/users")) return new Response(JSON.stringify([{
				display_name: "Test Person",
				default_workspace_id: "workspace-1",
				created_at: "2025-01-01T00:00:00Z",
				obfuscate_info: false,
			}]), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([{ role: "admin" }]), { status: 200 });
			if (url.includes("/workspaces") && url.includes("owner_user_id")) return new Response(JSON.stringify([{ owner_user_id: "user-1" }]), { status: 200 });
			if (url.includes("/workspaces")) return new Response(JSON.stringify([{ name: "Test Workspace" }]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/settings/profile?obfuscateInfo=1",
			{ headers: { authorization: "Bearer token" } },
			env,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		await expect(response.json()).resolves.toMatchObject({
			obfuscateInfo: true,
			profile: {
				userId: "user-1",
				displayName: "Test Person",
				workspaceName: "Test Workspace",
				totalRequests: 0,
				totalTokens: 0,
				usageWorkspaceCount: 0,
			},
		});
	});

	it("aggregates profile usage across every workspace membership", async () => {
		profileRepo.listProfileWorkspaceIds.mockResolvedValue(["workspace-1", "workspace-2"]);
		profileRepo.listProfileUsageRows.mockResolvedValue([
			{ bucket: new Date().toISOString(), model_id: "openai/gpt-test", requests: 2, tokens: 15, cost: .25 },
			{ bucket: new Date().toISOString(), model_id: "anthropic/claude-test", requests: 3, tokens: 25, cost: .5 },
		]);
		profileRepo.getProfileModelNames.mockResolvedValue(new Map([["openai/gpt-test", "GPT Test"], ["anthropic/claude-test", "Claude Test"]]));
		const requestedUrls: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			requestedUrls.push(url);
			if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({
				id: "user-1",
				email: "person@example.com",
				created_at: "2025-01-01T00:00:00Z",
				user_metadata: {},
			}), { status: 200 });
			if (url.includes("workspace_members")) return new Response(JSON.stringify([
				{ workspace_id: "workspace-1" },
				{ workspace_id: "workspace-2" },
			]), { status: 200 });
			if (url.includes("v2_models")) return new Response(JSON.stringify([
				{ model_id: "openai/gpt-test", name: "GPT Test" },
				{ model_id: "anthropic/claude-test", name: "Claude Test" },
			]), { status: 200 });
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/settings/profile/usage",
			{ headers: { authorization: "Bearer token" } },
			env,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		await expect(response.json()).resolves.toMatchObject({
			usage: {
				usageWorkspaceCount: 2,
				totalRequests: 5,
				totalTokens: 40,
				topModels: [
					{ id: "anthropic/claude-test", name: "Claude Test", requests: 3, tokens: 25 },
					{ id: "openai/gpt-test", name: "GPT Test", requests: 2, tokens: 15 },
				],
				modelActivity: expect.arrayContaining([
					expect.objectContaining({ id: "anthropic/claude-test", name: "Claude Test", requests: 3, tokens: 25 }),
					expect.objectContaining({ id: "openai/gpt-test", name: "GPT Test", requests: 2, tokens: 15 }),
				]),
			},
		});
		expect(profileRepo.listProfileWorkspaceIds).toHaveBeenCalledWith(env, "user-1", 100);
		expect(profileRepo.listProfileUsageRows).toHaveBeenCalledWith(env, ["workspace-1", "workspace-2"], 365);
	});
});
