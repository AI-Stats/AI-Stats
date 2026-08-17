import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	usageCalls: [] as unknown[][],
	chargeCalls: [] as Array<Record<string, unknown>>,
	warnings: [] as Array<Record<string, unknown>>,
}));

const repository = vi.hoisted(() => ({
	listExtendedRetentionWorkspaces: vi.fn(),
	usageSnapshot: vi.fn(),
	chargeOnce: vi.fn(),
	getWorkspace: vi.fn(),
	enqueueWarning: vi.fn(),
	listPrunableLogs: vi.fn(),
	markLogsDeleted: vi.fn(),
}));

const workspaceRow = {
	workspace_id: "00000000-0000-4000-8000-000000000001",
	io_logging_enabled: true,
	io_logging_retention_days: 365,
	io_logging_billing_status: "active",
	io_logging_grace_until: null,
	io_logging_last_billing_warning_at: null,
	io_logging_last_billing_warning_kind: null,
	io_logging_price_per_million_units_nanos: 0,
};

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({
		GATEWAY_IO_RETENTION_BILLING_LIMIT: "10",
		GATEWAY_IO_RETENTION_GRACE_DAYS: "14",
		GATEWAY_IO_RETENTION_PRICE_PER_MILLION_UNITS_NANOS: "0",
		GATEWAY_IO_RETENTION_PRUNE_LIMIT: "250",
	}),
}));

vi.mock("@/repositories/io-retention-billing", () => repository);
vi.mock("@/runtime/identity", () => ({
	getIdentityUserById: vi.fn(async () => ({ data: { user: { email: "owner@example.com", name: "Ada Lovelace" } } })),
}));

describe("runGatewayIoRetentionBillingJob", () => {
	beforeEach(() => {
		state.usageCalls.length = 0;
		state.chargeCalls.length = 0;
		state.warnings.length = 0;
		repository.listExtendedRetentionWorkspaces.mockResolvedValue([workspaceRow]);
		repository.usageSnapshot.mockImplementation(async (...args: unknown[]) => {
			state.usageCalls.push(args);
			return { event_units: 1_000_000, billable_bytes: 64 * 1024 * 1_000_000, object_count: 1_000_000 };
		});
		repository.chargeOnce.mockImplementation(async (args: Record<string, unknown>) => {
			state.chargeCalls.push(args);
			return { status: "grace", amount_nanos: args.amountNanos, before_balance_nanos: 0, after_balance_nanos: 0, grace_until: "2026-07-19T00:10:00.000Z" };
		});
		repository.getWorkspace.mockResolvedValue({ id: workspaceRow.workspace_id, name: "Acme", owner_user_id: "user_1" });
		repository.enqueueWarning.mockImplementation(async (args: Record<string, unknown>) => { state.warnings.push(args); });
		repository.listPrunableLogs.mockResolvedValue([]);
	});

	it("charges extended retention usage and queues a grace warning when credits are unavailable", async () => {
		const { runGatewayIoRetentionBillingJob } = await import("./io-retention-billing");

		const summary = await runGatewayIoRetentionBillingJob({
			asOf: new Date("2026-07-05T00:10:00.000Z"),
		});

		expect(summary).toEqual({
			processed: 1,
			charged: 0,
			grace: 1,
			suspended: 0,
			skipped: 0,
			prunedObjects: 0,
			warningsQueued: 1,
			failed: 0,
		});
		expect(state.usageCalls[0]).toEqual([workspaceRow.workspace_id, "2026-07-05T00:10:00.000Z", 90, 65_536]);
		expect(state.chargeCalls[0]).toMatchObject({
			workspaceId: workspaceRow.workspace_id,
			billingDate: "2026-07-05",
			eventUnits: 1_000_000,
			graceDays: 14,
			amountNanos: 59_501_026,
		});
		expect(state.warnings[0]).toMatchObject({
			kind: "io_retention_grace",
			template: "io_retention_grace",
			toEmail: "owner@example.com",
			workspaceId: workspaceRow.workspace_id,
			payload: expect.objectContaining({
				workspace_name: "Acme",
				retention_days: 365,
				grace_until: "2026-07-19T00:10:00.000Z",
			}),
			warningKind: "grace",
			warnedAt: "2026-07-05T00:10:00.000Z",
		});
	});
});
