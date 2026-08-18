import { beforeEach, describe, expect, it, vi } from "vitest";

const modelDiscoveryRepositoryMock = vi.hoisted(() => ({
	listSeenModels: vi.fn(),
	markPendingRemovals: vi.fn(),
}));

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({}),
}));

vi.mock("@/repositories/model-discovery", () => modelDiscoveryRepositoryMock);

import { fetchPreviousModelsByProviders, markPendingModelRemovals } from "./index";

type SeenModelRow = {
	provider_id: string;
	model_id: string;
	model_details: Record<string, unknown>;
	pricing_details: null;
	removal_pending?: boolean;
};

describe("fetchPreviousModelsByProviders", () => {
	beforeEach(() => {
		modelDiscoveryRepositoryMock.listSeenModels.mockReset();
		modelDiscoveryRepositoryMock.markPendingRemovals.mockReset();
	});

	it("loads more than 1,000 stored models in one repository query", async () => {
		const rows = Array.from({ length: 1_093 }, (_, index) => ({
			provider_id: "large-provider",
			model_id: `model-${index.toString().padStart(4, "0")}`,
			model_details: {},
			pricing_details: null,
		}));
		modelDiscoveryRepositoryMock.listSeenModels.mockResolvedValue(rows);

		const state = await fetchPreviousModelsByProviders(["large-provider"]);

		expect(state.byProvider.get("large-provider")?.modelIds).toHaveLength(1_093);
		expect(modelDiscoveryRepositoryMock.listSeenModels).toHaveBeenCalledOnce();
		expect(modelDiscoveryRepositoryMock.listSeenModels).toHaveBeenCalledWith(["large-provider"]);
	});

	it("does not need a sentinel query when the row count is exactly 1,000", async () => {
		const rows = Array.from({ length: 1_000 }, (_, index) => ({
			provider_id: "exact-provider",
			model_id: `model-${index.toString().padStart(4, "0")}`,
			model_details: {},
			pricing_details: null,
		}));
		modelDiscoveryRepositoryMock.listSeenModels.mockResolvedValue(rows);

		const state = await fetchPreviousModelsByProviders(["exact-provider"]);

		expect(state.byProvider.get("exact-provider")?.modelIds).toHaveLength(1_000);
		expect(modelDiscoveryRepositoryMock.listSeenModels).toHaveBeenCalledOnce();
	});

	it("loads provisional removals with the provider snapshot", async () => {
		modelDiscoveryRepositoryMock.listSeenModels.mockResolvedValue([{
			provider_id: "provider",
			model_id: "occasionally-missing-model",
			model_details: {},
			pricing_details: null,
			removal_pending: true,
		}]);

		const state = await fetchPreviousModelsByProviders(["provider"]);

		expect(state.byProvider.get("provider")?.pendingRemovalIds).toEqual(
			new Set(["occasionally-missing-model"]),
		);
	});
});

describe("markPendingModelRemovals", () => {
	it("refreshes retention while marking the first missing check", async () => {
		modelDiscoveryRepositoryMock.markPendingRemovals.mockResolvedValue(undefined);

		await markPendingModelRemovals([{
			provider_id: "provider",
			model_id: "temporarily-missing-model",
		}]);

		expect(modelDiscoveryRepositoryMock.markPendingRemovals).toHaveBeenCalledWith(
			"provider",
			["temporarily-missing-model"],
			expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
		);
	});
});
