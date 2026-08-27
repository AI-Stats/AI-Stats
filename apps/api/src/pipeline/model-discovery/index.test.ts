import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({}),
	getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

import { fetchPreviousModelsByProviders, markPendingModelRemovals } from "./index";

type SeenModelRow = {
	provider_id: string;
	model_id: string;
	watch_snapshot?: unknown;
	removal_pending?: boolean;
};

function buildPagedSupabase(rows: SeenModelRow[]) {
	const ranges: Array<[number, number]> = [];
	const query = {
		select: vi.fn(() => query),
		in: vi.fn(() => query),
		order: vi.fn(() => query),
		range: vi.fn(async (from: number, to: number) => {
			ranges.push([from, to]);
			return { data: rows.slice(from, to + 1), error: null };
		}),
	};
	return {
		ranges,
		client: { from: vi.fn(() => query) },
	};
}

describe("fetchPreviousModelsByProviders", () => {
	beforeEach(() => {
		getSupabaseAdminMock.mockReset();
	});

	it("loads every page when a shard has more than 1,000 stored models", async () => {
		const rows = Array.from({ length: 1_093 }, (_, index) => ({
			provider_id: "large-provider",
			model_id: `model-${index.toString().padStart(4, "0")}`,
			watch_snapshot: { contextLength: null, maxCompletionTokens: null, pricingDetails: null, pricingFingerprint: null },
		}));
		const supabase = buildPagedSupabase(rows);
		getSupabaseAdminMock.mockReturnValue(supabase.client);

		const state = await fetchPreviousModelsByProviders(["large-provider"]);

		expect(state.byProvider.get("large-provider")?.modelIds).toHaveLength(1_093);
		expect(supabase.ranges).toEqual([[0, 999], [1_000, 1_999]]);
	});

	it("requests an empty final page when the row count is an exact page multiple", async () => {
		const rows = Array.from({ length: 1_000 }, (_, index) => ({
			provider_id: "exact-provider",
			model_id: `model-${index.toString().padStart(4, "0")}`,
			watch_snapshot: null,
		}));
		const supabase = buildPagedSupabase(rows);
		getSupabaseAdminMock.mockReturnValue(supabase.client);

		const state = await fetchPreviousModelsByProviders(["exact-provider"]);

		expect(state.byProvider.get("exact-provider")?.modelIds).toHaveLength(1_000);
		expect(supabase.ranges).toEqual([[0, 999], [1_000, 1_999]]);
	});

	it("loads provisional removals with the provider snapshot", async () => {
		const supabase = buildPagedSupabase([{
			provider_id: "provider",
			model_id: "occasionally-missing-model",
			watch_snapshot: null,
			removal_pending: true,
		}]);
		getSupabaseAdminMock.mockReturnValue(supabase.client);

		const state = await fetchPreviousModelsByProviders(["provider"]);

		expect(state.byProvider.get("provider")?.pendingRemovalIds).toEqual(
			new Set(["occasionally-missing-model"]),
		);
	});
});

describe("markPendingModelRemovals", () => {
	it("refreshes retention while marking the first missing check", async () => {
		const query = {
			update: vi.fn(() => query),
			eq: vi.fn(() => query),
			in: vi.fn(async () => ({ error: null })),
		};
		getSupabaseAdminMock.mockReturnValue({ from: vi.fn(() => query) });

		await markPendingModelRemovals([{
			provider_id: "provider",
			model_id: "temporarily-missing-model",
		}]);

		expect(query.update).toHaveBeenCalledWith({
			removal_pending: true,
			last_seen_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
		});
	});
});
