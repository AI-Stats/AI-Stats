import type { ModelRouteParams } from "@/components/(data)/model/model-route-helpers";
import {
	redirectLegacyModelPath,
	type LegacySearchParams,
} from "../redirectLegacyModelPath";

export const instant = false;

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<ModelRouteParams & { legacyPath: string[] }>;
	searchParams: Promise<LegacySearchParams>;
}) {
	return redirectLegacyModelPath(params, searchParams);
}
