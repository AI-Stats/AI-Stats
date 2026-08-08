import { permanentRedirect } from "next/navigation";
import {
	getModelPath,
	resolveModelRouteIds,
	type ModelRouteParams,
} from "@/components/(data)/model/model-route-helpers";

export type LegacySearchParams = Record<
	string,
	string | string[] | undefined
>;

export async function redirectLegacyModelSection(
	params: Promise<ModelRouteParams>,
	sectionId: string,
	searchParams?: Promise<LegacySearchParams>,
): Promise<never> {
	const [{ canonicalModelId }, resolvedSearchParams] = await Promise.all([
		params.then((routeParams) => resolveModelRouteIds(routeParams, false)),
		searchParams ?? Promise.resolve<LegacySearchParams>({}),
	]);
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(resolvedSearchParams)) {
		if (Array.isArray(value)) {
			for (const item of value) query.append(key, item);
		} else if (value != null) {
			query.set(key, value);
		}
	}
	const queryString = query.toString();
	permanentRedirect(
		`${getModelPath(canonicalModelId)}${queryString ? `?${queryString}` : ""}#${sectionId}`,
	);
}
