import { beforeEach, describe, expect, it, vi } from "vitest";
import { callDataContributionGateway } from "./settings-data-contribution";

describe("data contribution gateway proxy", () => {
	beforeEach(() => vi.unstubAllGlobals());

	it("fails closed without a bearer token", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(callDataContributionGateway({
			env: { ENV: "production" },
			request: new Request("https://phaseo.app/api/account/settings/privacy"),
			workspaceId: "workspace-preview",
		})).resolves.toEqual({ status: 401, payload: { error: "unauthorized" } });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects a missing workspace before forwarding", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(callDataContributionGateway({
			env: { ENV: "production" },
			request: new Request("https://phaseo.app/api/account/settings/privacy", {
				headers: { authorization: "Bearer oauth-token" },
			}),
			workspaceId: "",
		})).resolves.toEqual({ status: 400, payload: { error: "bad_request", message: "workspaceId is required" } });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("forwards authorization to the authoritative gateway gate", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "not_found" }), { status: 404 }));
		vi.stubGlobal("fetch", fetchMock);
		const request = new Request("https://phaseo.app/api/account/settings/privacy", {
			headers: { authorization: "Bearer oauth-token" },
		});
		await expect(callDataContributionGateway({
			env: { ENV: "production", AI_STATS_GATEWAY_URL: "https://api.phaseo.app/" },
			request,
			workspaceId: "workspace-preview",
		})).resolves.toEqual({ status: 404, payload: { error: "not_found" } });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.phaseo.app/v1/data-contribution",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					authorization: "Bearer oauth-token",
					"x-phaseo-workspace-id": "workspace-preview",
				}),
				signal: expect.any(AbortSignal),
			}),
		);
	});
});
