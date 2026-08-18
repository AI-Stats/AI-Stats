"use client";

import useSWR from "swr";
import { MODEL_CATALOGUE_SWR_OPTIONS } from "@/lib/swr/catalogueCache";
import { publicSWRKeys } from "@/lib/swr/keys";
import {
	fetchModelsTableData,
	fetchModelsTableDataV2,
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
	const { data, error } = useSWR(swrKey, fetcher, MODEL_CATALOGUE_SWR_OPTIONS);

	if (error) throw error;
	if (!data) return <ModelsTablePageSkeleton />;

	return (
		<ModelsTableDisplay
			initialModelData={data.models}
			allEndpoints={data.allEndpoints}
			allModalities={data.allModalities}
			allFeatures={data.allFeatures}
			allStatuses={data.allStatuses}
		/>
	);
}
