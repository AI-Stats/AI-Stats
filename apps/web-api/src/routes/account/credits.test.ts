import { afterEach, describe, expect, it, vi } from "vitest";
const creditsRepo = vi.hoisted(() => ({ createCreditGrant: vi.fn(), deleteCreditGrant: vi.fn(), getCreditTierSummary: vi.fn(), getWalletBalance: vi.fn(), listCreditGrants: vi.fn(), listCreditWorkspaces: vi.fn(), redeemCreditGrant: vi.fn(), saveWorkspaceNotifications: vi.fn(), updateCreditGrant: vi.fn(), updateWalletTopUp: vi.fn() }));
vi.mock("@/repositories/credits", () => creditsRepo);
import app from "@/index";
import { parseLowBalanceThresholdNanos } from "./credits";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("account credit routes", () => {
	it("accepts non-negative low-balance thresholds with up to two decimal places", () => {
		expect(parseLowBalanceThresholdNanos(0)).toBe(0);
		expect(parseLowBalanceThresholdNanos(12)).toBe(12_000_000_000);
		expect(parseLowBalanceThresholdNanos(12.3)).toBe(12_300_000_000);
		expect(parseLowBalanceThresholdNanos(12.34)).toBe(12_340_000_000);
		expect(parseLowBalanceThresholdNanos(0.01)).toBe(10_000_000);
	});

	it("rejects invalid or over-precise low-balance thresholds", () => {
		expect(parseLowBalanceThresholdNanos(-1)).toBeNull();
		expect(parseLowBalanceThresholdNanos(12.345)).toBeNull();
		expect(parseLowBalanceThresholdNanos("not-a-number")).toBeNull();
	});

	it("rejects unauthenticated balance reads and marks them private", async () => {
		const response = await app.request("https://phaseo.app/api/account/credits/balance?workspaceId=workspace-1", {}, { ENV: "development" });
		expect(response.status).toBe(401);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("vary")).toBe("Authorization, Cookie");
	});

	it("returns an empty private redeem bootstrap for signed-out users", async () => {
		const response = await app.request("https://phaseo.app/api/account/credits/redeem-initial", {}, { ENV: "development" });
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
		await expect(response.json()).resolves.toEqual({
			activeWorkspaceId: null,
			invoiceTeamIds: [],
			signedIn: false,
			teamOptions: [],
		});
	});

	it("uses the active workspace cookie only after bearer and membership verification", async () => {
		creditsRepo.getWalletBalance.mockResolvedValue(12_500_000_000);
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/auth/v1/user")) {
				return new Response(JSON.stringify({
					id: "user-1",
					email: "user@example.com",
				}), { status: 200 });
			}
			if (url.includes("workspace_members")) {
				return new Response(JSON.stringify([{ workspace_id: "workspace-1" }]), { status: 200 });
			}
			if (url.includes("wallets")) {
				return new Response(JSON.stringify([{ balance_nanos: 12_500_000_000 }]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/credits/balance",
			{
				headers: {
					authorization: "Bearer session-token",
					cookie: "activeWorkspaceId=workspace-1",
				},
			},
			{
				ENV: "development",
			},
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
		await expect(response.json()).resolves.toEqual({ initialBalance: 12.5 });
	});

	it("queries the secured spend summary for the current workspace", async () => {
		creditsRepo.getCreditTierSummary.mockResolvedValue({ previous_nanos: 1_230_000_000, mtd_nanos: 4_560_000_000, tier: "basic" });
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = request.url;
			if (url.includes("/auth/v1/user")) {
				return Response.json({ id: "user-1", email: "user@example.com" });
			}
			if (url.includes("workspace_members")) {
				return Response.json([{ workspace_id: "workspace-1" }]);
			}
			if (url.includes("workspaces")) return Response.json([{ tier: "basic" }]);
			return Response.json([]);
		}));

		const response = await app.request(
			"https://phaseo.app/api/account/credits/tier-summary?workspaceId=workspace-1",
			{ headers: { authorization: "Bearer session-token" } },
			{
				ENV: "development",
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			lastMonthCents: 1_230_000_000,
			mtdCents: 4_560_000_000,
			teamTier: "basic",
		});
		expect(creditsRepo.getCreditTierSummary).toHaveBeenCalledWith(expect.anything(), "workspace-1");
	});
});
