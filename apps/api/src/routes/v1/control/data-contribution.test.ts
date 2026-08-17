import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequestActorMock = vi.fn();
const featureEnabledMock = vi.fn();

vi.mock("@/lib/oauth/service", () => ({
	getOAuthRequestActor: (...args: unknown[]) => getRequestActorMock(...args),
}));

vi.mock("@/repositories/management", () => ({
	findWorkspaceRole: vi.fn(async () => "admin"),
	findWorkspaceOwnerUserId: vi.fn(async () => "user-admin"),
}));

vi.mock("@/repositories/data-contribution", () => ({
	isPhaseoAdmin: vi.fn(async () => true),
	auditConsentEvent: vi.fn(), listWorkspaceKeyIds: vi.fn(), loadDataContributionOverview: vi.fn(),
	setDataContributionConsent: vi.fn(), createClassifier: vi.fn(), updateClassifier: vi.fn(), deleteClassifier: vi.fn(),
}));

vi.mock("@/core/feature-flags", () => ({
	isDataContributionAccessEnabled: (...args: unknown[]) => featureEnabledMock(...args),
}));

vi.mock("@/core/kv", () => ({ setKeyVersion: vi.fn() }));

import { authenticateDashboardDataContribution } from "./data-contribution";

function dashboardRequest() {
	return new Request("https://api.phaseo.app/v1/data-contribution", {
		headers: {
			authorization: "Bearer better-auth-session-token",
			"x-phaseo-workspace-id": "workspace-preview",
		},
	});
}

describe("dashboard data contribution authentication", () => {
	beforeEach(() => {
		getRequestActorMock.mockReset();
		featureEnabledMock.mockReset();
		getRequestActorMock.mockResolvedValue({ userId: "user-admin" });
		featureEnabledMock.mockResolvedValue(true);
	});

	it("accepts a validated Better Auth admin session only through the gated workspace header", async () => {
		const result = await authenticateDashboardDataContribution(dashboardRequest(), false);
		expect(result).toMatchObject({
			ok: true,
			workspaceId: "workspace-preview",
			userId: "user-admin",
			authMethod: "oauth",
		});
		expect(getRequestActorMock).toHaveBeenCalledWith(expect.any(Request));
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
