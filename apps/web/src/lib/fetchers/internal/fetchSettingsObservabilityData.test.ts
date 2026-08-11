import { fetchSettingsObservabilityData } from "./fetchSettingsObservabilityData";

const getServerAccountContext = jest.fn();
const resolveAccessibleWorkspaceIdFromCookie = jest.fn();
const fetchAccountWebApi = jest.fn();

jest.mock("./serverAccountContext", () => ({ getServerAccountContext }));
jest.mock("@/utils/workspaceCookie", () => ({ resolveAccessibleWorkspaceIdFromCookie }));
jest.mock("@/lib/web-api/client", () => ({ fetchAccountWebApi }));

const request = {
	from: "2026-08-01T00:00:00.000Z",
	to: "2026-08-02T00:00:00.000Z",
	previousFrom: "2026-07-31T00:00:00.000Z",
	previousTo: "2026-08-01T00:00:00.000Z",
};

describe("fetchSettingsObservabilityData", () => {
	beforeEach(() => {
		jest.resetAllMocks();
		getServerAccountContext.mockResolvedValue({
			accessToken: "token",
			obfuscateInfo: null,
			workspaceId: "stale-workspace",
		});
	});

	it("always validates an active workspace cookie before loading usage data", async () => {
		resolveAccessibleWorkspaceIdFromCookie.mockResolvedValue("accessible-workspace");
		fetchAccountWebApi.mockResolvedValue({ workspaceId: "accessible-workspace" });

		await expect(fetchSettingsObservabilityData(request)).resolves.toEqual({
			status: "loaded",
			data: { workspaceId: "accessible-workspace" },
		});
		expect(resolveAccessibleWorkspaceIdFromCookie).toHaveBeenCalledWith({
			throwOnFailure: true,
		});
		expect(fetchAccountWebApi).toHaveBeenCalledWith(
			expect.stringContaining("workspaceId=accessible-workspace"),
			"token",
		);
		expect(fetchAccountWebApi).not.toHaveBeenCalledWith(
			expect.stringContaining("workspaceId=stale-workspace"),
			expect.anything(),
		);
	});

	it("returns no-workspace without requesting usage data", async () => {
		resolveAccessibleWorkspaceIdFromCookie.mockResolvedValue(undefined);

		await expect(fetchSettingsObservabilityData(request)).resolves.toEqual({
			status: "no-workspace",
		});
		expect(fetchAccountWebApi).not.toHaveBeenCalled();
	});

	it("returns unauthenticated without resolving a workspace", async () => {
		getServerAccountContext.mockResolvedValue({
			accessToken: null,
			obfuscateInfo: null,
			workspaceId: "stale-workspace",
		});

		await expect(fetchSettingsObservabilityData(request)).resolves.toEqual({
			status: "unauthenticated",
		});
		expect(resolveAccessibleWorkspaceIdFromCookie).not.toHaveBeenCalled();
		expect(fetchAccountWebApi).not.toHaveBeenCalled();
	});

	it("returns load-failed when workspace validation fails", async () => {
		resolveAccessibleWorkspaceIdFromCookie.mockRejectedValue(new Error("unavailable"));

		await expect(fetchSettingsObservabilityData(request)).resolves.toEqual({
			status: "load-failed",
		});
		expect(fetchAccountWebApi).not.toHaveBeenCalled();
	});

	it("returns load-failed when the observability request fails", async () => {
		resolveAccessibleWorkspaceIdFromCookie.mockResolvedValue("accessible-workspace");
		fetchAccountWebApi.mockRejectedValue(new Error("unavailable"));

		await expect(fetchSettingsObservabilityData(request)).resolves.toEqual({
			status: "load-failed",
		});
	});
});
