import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	betterAuthUrl: "https://phaseo.app",
}));

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({
		BETTER_AUTH_URL: state.betterAuthUrl,
	}),
}));

import { getOAuthRequestActor } from "./service";

afterEach(() => {
	vi.unstubAllGlobals();
	state.betterAuthUrl = "https://phaseo.app";
});

describe("Better Auth OAuth request actor", () => {
	it("forwards a bearer session to the canonical Better Auth endpoint", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({
			user: { id: "user-1", email: "user@example.com", name: "Phaseo User" },
		}));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getOAuthRequestActor(new Request("https://api.phaseo.app/oauth/authorize", {
			headers: { Authorization: "Bearer better-session-token" },
		}))).resolves.toEqual({
			userId: "user-1",
			email: "user@example.com",
			name: "Phaseo User",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			new URL("https://phaseo.app/api/auth/get-session"),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer better-session-token" }),
				redirect: "error",
			}),
		);
	});

	it("forwards the secure session cookie and fails closed without credentials", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ user: { id: "user-2" } }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getOAuthRequestActor(new Request("https://api.phaseo.app/oauth/authorize", {
			headers: { Cookie: "better-auth.session_token=opaque" },
		}))).resolves.toMatchObject({ userId: "user-2" });
		expect(fetchMock).toHaveBeenCalledWith(
			new URL("https://phaseo.app/api/auth/get-session"),
			expect.objectContaining({ headers: expect.objectContaining({ Cookie: "better-auth.session_token=opaque" }) }),
		);

		fetchMock.mockClear();
		await expect(getOAuthRequestActor(new Request("https://api.phaseo.app/oauth/authorize"))).resolves.toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects an insecure configured session origin", async () => {
		state.betterAuthUrl = "http://attacker.example";
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(getOAuthRequestActor(new Request("https://api.phaseo.app/oauth/authorize", {
			headers: { Authorization: "Bearer better-session-token" },
		}))).resolves.toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("denies OAuth consent until migrated MFA is re-enrolled", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
			user: { id: "user-1", mfaReenrollmentRequired: true },
		})));

		await expect(getOAuthRequestActor(new Request("https://api.phaseo.app/oauth/authorize", {
			headers: { Authorization: "Bearer better-session-token" },
		}))).resolves.toBeNull();
	});
});
