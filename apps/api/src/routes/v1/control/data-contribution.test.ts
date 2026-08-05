import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseActorMock = vi.fn();
const featureEnabledMock = vi.fn();

function queryFor(table: string) {
	const query: any = {
		select: () => query,
		eq: () => query,
		maybeSingle: async () => {
			if (table === "workspace_members") return { data: { role: "admin" }, error: null };
			if (table === "workspaces") return { data: { owner_user_id: "user-admin" }, error: null };
			if (table === "users") return { data: { role: "admin" }, error: null };
			return { data: null, error: null };
		},
	};
	return query;
}

vi.mock("@/runtime/env", () => ({
	getSupabaseAdmin: () => ({ from: (table: string) => queryFor(table) }),
}));

vi.mock("@/lib/oauth/service", () => ({
	getSupabaseActor: (...args: unknown[]) => getSupabaseActorMock(...args),
}));

vi.mock("@/core/feature-flags", () => ({
	isDataContributionAccessEnabled: (...args: unknown[]) => featureEnabledMock(...args),
}));

vi.mock("@/core/kv", () => ({ setKeyVersion: vi.fn() }));

import { authenticateDashboardDataContribution } from "./data-contribution";

function dashboardRequest() {
	return new Request("https://api.phaseo.app/v1/data-contribution", {
		headers: {
			authorization: "Bearer supabase-session-token",
			"x-phaseo-workspace-id": "workspace-preview",
		},
	});
}

describe("dashboard data contribution authentication", () => {
	beforeEach(() => {
		getSupabaseActorMock.mockReset();
		featureEnabledMock.mockReset();
		getSupabaseActorMock.mockResolvedValue({ userId: "user-admin" });
		featureEnabledMock.mockResolvedValue(true);
	});

	it("accepts a validated Supabase admin session only through the gated workspace header", async () => {
		const result = await authenticateDashboardDataContribution(dashboardRequest(), false);
		expect(result).toMatchObject({
			ok: true,
			workspaceId: "workspace-preview",
			userId: "user-admin",
			authMethod: "oauth",
		});
		expect(getSupabaseActorMock).toHaveBeenCalledWith("supabase-session-token");
		expect(featureEnabledMock).toHaveBeenCalledWith(expect.objectContaining({
			workspaceId: "workspace-preview",
			userId: "user-admin",
		}));
	});

	it("fails closed when Statsig does not select the admin", async () => {
		featureEnabledMock.mockResolvedValue(false);
		const result = await authenticateDashboardDataContribution(dashboardRequest(), false);
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(404);
	});
});
