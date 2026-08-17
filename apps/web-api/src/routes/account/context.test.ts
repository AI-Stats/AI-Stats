import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const getWorkspaceAccess = vi.fn();

vi.mock("@/auth/requireUser", () => ({ requireUser: (...args: unknown[]) => requireUser(...args) }));
vi.mock("@/repositories/workspace-access", () => ({ getWorkspaceAccess: (...args: unknown[]) => getWorkspaceAccess(...args) }));

import { requireAccountWorkspace } from "./context";

describe("requireAccountWorkspace tenant isolation", () => {
	beforeEach(() => {
		requireUser.mockReset().mockResolvedValue({ id: "user_a", email: "a@example.com" });
		getWorkspaceAccess.mockReset();
	});

	it("rejects a signed-in user without membership or ownership", async () => {
		getWorkspaceAccess.mockResolvedValue(null);
		await expect(requireAccountWorkspace({
			env: {} as never,
			request: new Request("https://phaseo.app"),
			workspaceId: "workspace_b",
		})).resolves.toBeNull();
	});

	it("accepts ownership and never trusts a requested workspace by itself", async () => {
		getWorkspaceAccess.mockResolvedValue({ workspaceId: "workspace_a", role: "owner" });
		await expect(requireAccountWorkspace({
			env: {} as never,
			request: new Request("https://phaseo.app"),
			workspaceId: "workspace_a",
		})).resolves.toMatchObject({ workspaceId: "workspace_a", role: "owner" });
		expect(getWorkspaceAccess).toHaveBeenCalledWith(expect.anything(), "user_a", "workspace_a");
	});
});
