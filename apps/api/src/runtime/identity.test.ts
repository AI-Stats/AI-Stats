import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ findFirst: vi.fn(), end: vi.fn() }));
vi.mock("./env", () => ({ getBindings: () => ({ PLANETSCALE_HYPERDRIVE: {} }) }));
vi.mock("./db", () => ({
	createDatabase: () => ({
		db: { query: { user: { findFirst: state.findFirst } } },
		client: { end: state.end },
	}),
}));

import { getIdentityUserById } from "./identity";

describe("Better Auth identity repository", () => {
	beforeEach(() => {
		state.findFirst.mockReset();
		state.end.mockReset().mockResolvedValue(undefined);
	});

	it("reads the Better Auth user with Drizzle", async () => {
		state.findFirst.mockResolvedValue({ id: "u1", email: "u@example.com", name: "User", image: null });
		await expect(getIdentityUserById("u1")).resolves.toMatchObject({
			data: { user: { id: "u1", email: "u@example.com", name: "User" } },
			error: null,
		});
		expect(state.findFirst).toHaveBeenCalledOnce();
		expect(state.end).toHaveBeenCalledWith({ timeout: 1 });
	});

	it("fails closed while preserving the repository error", async () => {
		const error = new Error("database unavailable");
		state.findFirst.mockRejectedValue(error);
		await expect(getIdentityUserById("u1")).resolves.toEqual({ data: { user: null }, error });
		expect(state.end).toHaveBeenCalledOnce();
	});
});
