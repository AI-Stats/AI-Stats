"use client";

import { useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import {
	MODEL_CATALOGUE_SWR_OPTIONS,
	modelCatalogueRevalidationPath,
} from "@/lib/swr/catalogueCache";
import { publicSWRKeys } from "@/lib/swr/keys";
import {
	fetchModelsTableData,
	fetchModelsTableDataV2,
	combineModelsTablePages,
	type ModelsTableResponse,
} from "@/lib/swr/modelsTable";
import ModelsTableDisplay from "@/components/(data)/models/Models/ModelsTableDisplay";
import { ModelsTablePageSkeleton } from "@/components/(data)/models/Models/ModelsTablePageSkeleton";

type ModelsTablePageClientProps = {
	catalogueVersion?: "v1" | "v2";
};

export default function ModelsTablePageClient({
	catalogueVersion = "v1",
}: ModelsTablePageClientProps) {
	const swrKey =
		catalogueVersion === "v2"
			? publicSWRKeys.modelsTableV2
			: publicSWRKeys.modelsTable;
	const fetcher =
		catalogueVersion === "v2"
			? fetchModelsTableDataV2
			: fetchModelsTableData;
	const { data: pages, error, isValidating, mutate, setSize } = useSWRInfinite(
		(index, previousPage: ModelsTableResponse | null) => {
			if (index === 0) return swrKey;
			if (!previousPage?.next_cursor) return null;
			const url = new URL(swrKey, "https://phaseo.local");
			url.searchParams.set("cursor", previousPage.next_cursor);
			return `${url.pathname}${url.search}`;
		},
		fetcher,
		MODEL_CATALOGUE_SWR_OPTIONS,
	);
	const data = useMemo(
		() => pages?.length ? combineModelsTablePages(pages) : null,
		[pages],
	);
	const hasMore = Boolean(pages?.at(-1)?.next_cursor);
	const isLoadingMore = isValidating && Boolean(pages);
	const revalidate = async () => {
		await setSize(1);
		const firstPage = await fetcher(modelCatalogueRevalidationPath(swrKey));
		await mutate([firstPage], { revalidate: false });
	};

	if (error) throw error;
	if (!data) return <ModelsTablePageSkeleton />;

	return (
		<ModelsTableDisplay
			initialModelData={data.models}
			allEndpoints={data.allEndpoints}
			allModalities={data.allModalities}
			allFeatures={data.allFeatures}
			allStatuses={data.allStatuses}
			hasMore={hasMore}
			isLoadingMore={isLoadingMore}
			onLoadMore={() => void setSize((size) => size + 1)}
			onRevalidate={() => void revalidate()}
		/>
	);
}
