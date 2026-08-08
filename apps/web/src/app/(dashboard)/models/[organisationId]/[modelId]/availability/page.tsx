import type { ModelRouteParams } from "@/components/(data)/model/model-route-helpers";
import {
	redirectLegacyModelSection,
	type LegacySearchParams,
} from "../redirectLegacyModelSection";

export const instant = false;

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<ModelRouteParams>;
	searchParams: Promise<LegacySearchParams>;
}) {
	return redirectLegacyModelSection(params, "uptime", searchParams);
}
