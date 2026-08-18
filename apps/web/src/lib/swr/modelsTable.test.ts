import type { MonitorModelTableRow } from "@/lib/fetchers/models/table-view/types";
import {
	fetchModelsTableData,
	fetchModelsTableDataV2,
	combineModelsTablePages,
} from "@/lib/swr/modelsTable";

function row(id: string): MonitorModelTableRow {
	return {
		id,
		model: id,
		modelId: id,
		provider: {
			id: "test",
			name: "Test",
			inputPrice: 1,
			outputPrice: 2,
			features: [],
		},
		endpoint: "responses",
		gatewayStatus: "active",
		inputModalities: ["text"],
		outputModalities: ["text"],
		context: 128000,
		maxOutput: 4096,
	};
}

const facets = {
	endpoints: ["responses"],
	modalities: ["text"],
	features: ["web_search", "reasoning"],
	statuses: ["active"],
};

describe("fetchModelsTableData", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("loads one cursor page and preserves compact filter facets", async () => {
		const fetchMock = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({
			models: [row("one")], facets, catalogue_version: "v1", shape: "table",
			next_cursor: "next", has_more: true, limit: 1,
		})));
		global.fetch = fetchMock;

		const result = await fetchModelsTableData(
			"/api/_web/models?limit=1&shape=table&projection=3",
		);

		expect(result.models.map((model) => model.id)).toEqual(["one"]);
		expect(result.next_cursor).toBe("next");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("combines facets as cursor pages are progressively loaded", () => {
		const result = combineModelsTablePages([
			{ models: [row("one")], facets, catalogue_version: "v1", shape: "table", limit: 1 },
			{ models: [row("two")], facets: { endpoints: ["embeddings"], features: ["tools"] }, catalogue_version: "v1", shape: "table", limit: 1 },
		]);
		expect(result.models.map((model) => model.id)).toEqual(["one", "two"]);
		expect(result.allEndpoints).toEqual(["embeddings", "responses"]);
		expect(result.allFeatures).toEqual(["reasoning", "tools", "web_search"]);
	});

	it("loads and validates the dedicated V2 table response", async () => {
		global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
			models: [row("v2")], facets, catalogue_version: "v2", shape: "table",
			limit: 250,
		})));

		const result = await fetchModelsTableDataV2(
			"/api/_web/models?limit=10000&shape=table&catalogue_version=v2",
		);

		expect(result.models.map((model) => model.id)).toEqual(["v2"]);
	});

	it("rejects a non-table response for the table cache key", async () => {
		global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
			models: [], facets, catalogue_version: "v2", shape: "page",
			total: 0, limit: 10000, offset: 0,
		})));

		await expect(fetchModelsTableDataV2(
			"/api/_web/models?shape=table&catalogue_version=v2",
		)).rejects.toThrow("invalid response shape");
	});

});
