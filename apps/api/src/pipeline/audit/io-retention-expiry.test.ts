import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	rows: [] as Array<{ id: string; io_log_object_key: string | null }>,
	deletedObjects: [] as string[],
	deletedRows: [] as string[],
	cutoff: "",
}));

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({
		GATEWAY_IO_LOGS_BUCKET: {
			delete: vi.fn(async (key: string) => { state.deletedObjects.push(key); }),
		},
	}),
	getSupabaseAdmin: () => ({
		from: () => ({
			select: () => ({
				eq: () => ({
					not: () => ({
						not: () => ({
							lt: (_column: string, cutoff: string) => {
								state.cutoff = cutoff;
								return {
									order: () => ({ limit: async () => ({ data: state.rows, error: null }) }),
								};
							},
						}),
					}),
				}),
			}),
			delete: () => ({
				eq: async (_column: string, id: string) => {
					state.deletedRows.push(id);
					return { error: null };
				},
			}),
		}),
	}),
}));

import { pruneExpiredGatewayIoLogs } from "./io-retention-expiry";

describe("pruneExpiredGatewayIoLogs", () => {
	beforeEach(() => {
		state.rows = [];
		state.deletedObjects = [];
		state.deletedRows = [];
		state.cutoff = "";
	});

	it("deletes expired R2 objects and their metadata index rows", async () => {
		state.rows = [
			{ id: "log_1", io_log_object_key: "workspaces/ws_1/one.json" },
			{ id: "log_2", io_log_object_key: "workspaces/ws_1/two.json" },
		];

		await expect(pruneExpiredGatewayIoLogs({
			asOf: new Date("2026-08-30T13:00:00.000Z"),
			limit: 100,
		})).resolves.toEqual({ selected: 2, deleted: 2, failed: 0 });

		expect(state.cutoff).toBe("2026-08-30T13:00:00.000Z");
		expect(state.deletedObjects).toEqual([
			"workspaces/ws_1/one.json",
			"workspaces/ws_1/two.json",
		]);
		expect(state.deletedRows).toEqual(["log_1", "log_2"]);
	});
});
