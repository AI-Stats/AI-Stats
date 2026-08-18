import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
	getStateValue: vi.fn(),
}));

vi.mock("@/repositories/model-discovery", () => repository);

import {
	loadLatestConfiguredCoverageState,
	loadLatestDiscordNotificationFingerprint,
	loadLatestPricingCursor,
	loadLatestPricingTableState,
} from "./helpers";

describe("model discovery runtime state", () => {
	beforeEach(() => repository.getStateValue.mockReset());

	it("loads the global pricing cursor without scanning audit summaries", async () => {
		repository.getStateValue.mockResolvedValue({
			updatedAt: "2026-08-18T07:00:00.000Z",
			ruleIdsAtTimestamp: ["rule-b", "rule-a"],
		});

		await expect(loadLatestPricingCursor()).resolves.toEqual({
			updatedAt: "2026-08-18T07:00:00.000Z",
			ruleIdsAtTimestamp: ["rule-b", "rule-a"],
		});
		expect(repository.getStateValue).toHaveBeenCalledWith("__global__", "pricing_cursor");
	});

	it("loads source-scoped coverage, notification, and pricing-table state", async () => {
		repository.getStateValue
			.mockResolvedValueOnce({ fingerprint: "coverage", providerChanges: [] })
			.mockResolvedValueOnce("notification")
			.mockResolvedValueOnce([{ providerId: "openrouter", fingerprint: "pricing" }]);

		await expect(loadLatestConfiguredCoverageState("cron:shard-1")).resolves.toMatchObject({
			fingerprint: "coverage",
		});
		await expect(loadLatestDiscordNotificationFingerprint("cron:shard-1")).resolves.toBe("notification");
		await expect(loadLatestPricingTableState("cron:shard-1")).resolves.toEqual([
			{ providerId: "openrouter", fingerprint: "pricing" },
		]);
		expect(repository.getStateValue.mock.calls).toEqual([
			["cron:shard-1", "configured_coverage"],
			["cron:shard-1", "notification_fingerprint"],
			["cron:shard-1", "pricing_table"],
		]);
	});
});
