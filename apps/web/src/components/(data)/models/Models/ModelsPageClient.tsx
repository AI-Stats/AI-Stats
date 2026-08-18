"use client";

import useSWR from "swr";
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
	const { data, error } = useSWR(swrKey, fetcher, {
		dedupingInterval: 60 * 60 * 1_000,
		refreshInterval: 60 * 60 * 1_000,
		revalidateOnFocus: false,
	});

	if (error) throw error;
	if (!data) return <ModelsPageSkeleton />;

	return <ModelsDisplay modelsPageData={data} />;
}
