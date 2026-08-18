"use client";

import useSWR from "swr";
import { MODEL_CATALOGUE_SWR_OPTIONS } from "@/lib/swr/catalogueCache";
import { publicSWRKeys } from "@/lib/swr/keys";
import {
	fetchModelsPageData,
	fetchModelsPageDataV2,
} from "@/lib/swr/models";
import ModelsDisplay from "./ModelsDisplay";
import { ModelsPageSkeleton } from "./ModelsPageSkeleton";

type ModelsPageClientProps = {
	catalogueVersion?: "v1" | "v2";
};

export default function ModelsPageClient({
	catalogueVersion = "v1",
}: ModelsPageClientProps) {
	const swrKey =
		catalogueVersion === "v2" ? publicSWRKeys.modelsV2 : publicSWRKeys.models;
	const fetcher =
		catalogueVersion === "v2" ? fetchModelsPageDataV2 : fetchModelsPageData;
	const { data, error } = useSWR(swrKey, fetcher, MODEL_CATALOGUE_SWR_OPTIONS);

	if (error) throw error;
	if (!data) return <ModelsPageSkeleton />;

	return <ModelsDisplay modelsPageData={data} />;
}
