import { featureOrder } from "@/lib/config/featureLabels";
import type {
	ModelsTableData,
	MonitorModelTableRow,
} from "@/lib/fetchers/models/table-view/types";
import { publicSWRFetcher } from "@/lib/swr/publicFetcher";

type ModelsCatalogueVersion = "v1" | "v2";

export type ModelsTableResponse = {
	models: MonitorModelTableRow[];
	facets?: {
		endpoints?: string[];
		modalities?: string[];
		features?: string[];
		statuses?: string[];
	};
	catalogue_version?: ModelsCatalogueVersion;
	shape?: string;
	next_cursor?: string | null;
	has_more?: boolean;
	limit: number;
};

function sortFeatures(features: string[]): string[] {
	const order = new Map(featureOrder.map((feature, index) => [feature, index]));
	return [...features].sort((left, right) => {
		const leftIndex = order.get(left);
		const rightIndex = order.get(right);
		if (leftIndex !== undefined || rightIndex !== undefined) {
			if (leftIndex === undefined) return 1;
			if (rightIndex === undefined) return -1;
			return leftIndex - rightIndex;
		}
		return left.localeCompare(right);
	});
}

function assertTablePage(
	page: ModelsTableResponse,
	expectedVersion: ModelsCatalogueVersion,
	requireFacets = false,
): void {
	if (page.catalogue_version !== expectedVersion) {
		throw new Error(
			`Models table API returned catalogue ${page.catalogue_version ?? "unknown"} for ${expectedVersion} request`,
		);
	}
	if (page.shape !== "table") {
		throw new Error("Models table API returned an invalid response shape");
	}
	if (requireFacets && !page.facets) {
		throw new Error("Models table API response did not include filter facets");
	}
}

async function fetchModelsTablePageForVersion(
	path: string,
	expectedVersion: ModelsCatalogueVersion,
): Promise<ModelsTableResponse> {
	const page = await publicSWRFetcher<ModelsTableResponse>(path);
	assertTablePage(page, expectedVersion, true);
	return page;
}

export function combineModelsTablePages(
	pages: ModelsTableResponse[],
): ModelsTableData {
	const endpoints = new Set<string>();
	const modalities = new Set<string>();
	const features = new Set<string>();
	const statuses = new Set<string>();
	for (const page of pages) {
		for (const value of page.facets?.endpoints ?? []) endpoints.add(value);
		for (const value of page.facets?.modalities ?? []) modalities.add(value);
		for (const value of page.facets?.features ?? []) features.add(value);
		for (const value of page.facets?.statuses ?? []) statuses.add(value);
	}
	return {
		models: pages.flatMap((page) => page.models),
		allEndpoints: [...endpoints].sort(),
		allModalities: [...modalities].sort(),
		allFeatures: sortFeatures([...features]),
		allStatuses: [...statuses].sort(),
	};
}

export function fetchModelsTableData(path: string): Promise<ModelsTableResponse> {
	return fetchModelsTablePageForVersion(path, "v1");
}

export function fetchModelsTableDataV2(path: string): Promise<ModelsTableResponse> {
	return fetchModelsTablePageForVersion(path, "v2");
}
