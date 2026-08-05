import { permanentRedirect } from "next/navigation";
import {
	getModelPath,
	resolveModelRouteIds,
	type ModelRouteParams,
} from "@/components/(data)/model/model-route-helpers";
import { fetchFrontendModelHeader } from "@/lib/fetchers/frontend/fetchPublicCatalog";

export default async function Page({
	params,
}: {
	params: Promise<ModelRouteParams>;
}) {
	const routeParams = await params;
	const { canonicalModelId } = await resolveModelRouteIds(routeParams, false);
	const header = await fetchFrontendModelHeader(canonicalModelId, false);

	if (header?.family_id) {
		permanentRedirect(`/families/${header.family_id}`);
	}

	permanentRedirect(getModelPath(canonicalModelId));
}
