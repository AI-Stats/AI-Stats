import { vi } from "vitest";

vi.mock("@/repositories/identity", () => ({
	findIdentityBySessionToken: vi.fn(async (_env, token: string) => token ? ({
		id: "user-1", email: "user@example.com", createdAt: "2026-01-01T00:00:00.000Z",
		appMetadata: {}, userMetadata: {}, twoFactorEnabled: true, mfaReenrollmentRequired: false,
	}) : null),
	deleteIdentity: vi.fn(async () => undefined),
	updateIdentity: vi.fn(async () => null),
}));

vi.mock("@/repositories/workspace-access", () => ({
	getWorkspaceAccess: vi.fn(async (_env, _userId: string, workspaceId: string) => workspaceId && workspaceId !== "workspace-2" ? ({ workspaceId, role: "owner" }) : null),
	listWorkspaceAccess: vi.fn(async () => []),
}));
