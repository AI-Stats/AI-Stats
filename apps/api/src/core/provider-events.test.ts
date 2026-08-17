import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ claimProviderEvents: vi.fn(), claimProviderEvent: vi.fn(), markProviderEventProcessed: vi.fn() }));
vi.mock("@/repositories/provider-events", () => repository);

import { claimProviderEvent, listUnprocessedProviderEvents, markProviderEventProcessed } from "./provider-events";

describe("provider event replay claims", () => {
	beforeEach(() => vi.clearAllMocks());

	it("claims due events atomically with a bounded lease", async () => {
		repository.claimProviderEvents.mockResolvedValue([{ id: "event_row_1", provider: "openai", provider_event_id: "evt_1", kind: "batch.completed", workspace_id: null, internal_id: null, payload: {}, processed_at: null, attempt_count: 0, next_attempt_at: null, created_at: "2026-07-18T00:00:00.000Z" }]);
		await expect(listUnprocessedProviderEvents({ providers: ["openai", "openai", "google-ai-studio"], limit: 1_000, workerId: "worker-1", leaseSeconds: 5 })).resolves.toEqual([expect.objectContaining({ providerEventId: "evt_1" })]);
		expect(repository.claimProviderEvents).toHaveBeenCalledWith({ providers: ["openai", "google-ai-studio"], limit: 500, workerId: "worker-1", leaseSeconds: 30 });
	});

	it("claims one webhook delivery by provider event id", async () => {
		repository.claimProviderEvent.mockResolvedValue(true);
		await expect(claimProviderEvent({ provider: "openai", providerEventId: "evt_1", workerId: "webhook-1", leaseSeconds: 5 })).resolves.toBe(true);
		expect(repository.claimProviderEvent).toHaveBeenCalledWith({ provider: "openai", providerEventId: "evt_1", workerId: "webhook-1", leaseSeconds: 30 });
	});

	it("clears replay leases when processing completes", async () => {
		await markProviderEventProcessed({ provider: "openai", providerEventId: "evt_1" });
		expect(repository.markProviderEventProcessed).toHaveBeenCalledWith({ provider: "openai", providerEventId: "evt_1", workspaceId: null, internalId: null });
	});
});
