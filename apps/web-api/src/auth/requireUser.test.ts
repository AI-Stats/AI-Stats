import { afterEach, describe, expect, it, vi } from "vitest";

const findIdentityBySessionToken = vi.hoisted(() => vi.fn());
vi.mock("@/repositories/identity", () => ({ findIdentityBySessionToken }));

import type { Env } from "@/env";
import { requireUser } from "./requireUser";

const env: Env = {
	BETTER_AUTH_URL: "https://phaseo.app",
	ENV: "development",
};

afterEach(() => {
	findIdentityBySessionToken.mockReset();
	vi.restoreAllMocks();
});

describe("requireUser Better Auth", () => {
	it("validates bearer sessions directly against the PlanetScale auth tables", async () => {
		findIdentityBySessionToken.mockResolvedValueOnce({
			appMetadata: { provider: "google" },
			createdAt: "2025-08-12T07:42:35.000Z",
			email: "person@example.com",
			id: "user-id",
			mfaReenrollmentRequired: false,
			twoFactorEnabled: false,
			userMetadata: { name: "Person" },
		});
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const user = await requireUser(new Request("https://phaseo.app/api/account/auth/status", {
			headers: { authorization: "Bearer better-session-token" },
		}), env);

		expect(user).toMatchObject({ id: "user-id", email: "person@example.com" });
		expect(findIdentityBySessionToken).toHaveBeenCalledWith(env, "better-session-token");
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("validates a Better Auth cookie through the canonical auth service", async () => {
		const request = new Request("https://phaseo.app/api/account/auth/status", {
			headers: { cookie: "better-auth.session_token=signed-token" },
		});
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({
				session: { createdAt: "2026-08-14T10:00:00.000Z" },
				user: {
					appMetadata: { provider: "google" },
					createdAt: "2025-08-12T07:42:35.000Z",
					email: "person@example.com",
					id: "user-id",
					userMetadata: { name: "Person" },
				},
			}),
		);

		await expect(requireUser(request, env)).resolves.toMatchObject({
			appMetadata: { provider: "google" },
			email: "person@example.com",
			id: "user-id",
			userMetadata: { name: "Person" },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://phaseo.app/api/auth/get-session",
			expect.objectContaining({
				headers: expect.objectContaining({ Cookie: "better-auth.session_token=signed-token" }),
				redirect: "manual",
			}),
		);
	});

	it("does not require a rollout flag to validate Better Auth cookies", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const request = new Request("https://phaseo.app/api/account/auth/status", {
			headers: { cookie: "better-auth.session_token=signed-token" },
		});

		fetchMock.mockResolvedValue(Response.json({ session: {}, user: { id: "user-id", email: "person@example.com" } }));
		await expect(requireUser(request, env)).resolves.toMatchObject({ id: "user-id" });
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("maps Better Auth two-factor state for bearer introspection", async () => {
		const request = new Request("https://phaseo.app/api/account/auth/status", {
			headers: { authorization: "Bearer better-session-token" },
		});
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({
				session: { createdAt: "2026-08-14T10:00:00.000Z" },
				user: {
					createdAt: "2025-08-12T07:42:35.000Z",
					email: "person@example.com",
					id: "user-id",
					twoFactorEnabled: true,
				},
			}),
		);

		await expect(requireUser(request, env)).resolves.toMatchObject({
			id: "user-id",
			factors: [{ id: "better-auth-totp", factor_type: "totp", status: "verified" }],
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://phaseo.app/api/auth/get-session",
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer better-session-token" }),
			}),
		);
	});

	it("fails closed when session introspection fails", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));
		const request = new Request("https://phaseo.app/api/account/auth/status", {
			headers: { cookie: "better-auth.session_token=signed-token" },
		});

		await expect(requireUser(request, env)).resolves.toBeNull();
	});

	it("preserves the migrated MFA re-enrollment marker", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
			session: { createdAt: "2026-08-14T10:00:00.000Z" },
			user: {
				id: "user-id",
				email: "person@example.com",
				mfaReenrollmentRequired: true,
			},
		}));

		await expect(requireUser(new Request("https://phaseo.app/api/account/session", {
			headers: { cookie: "better-auth.session_token=signed-token" },
		}), env)).resolves.toMatchObject({
			id: "user-id",
			mfaReenrollmentRequired: true,
		});
	});
});
