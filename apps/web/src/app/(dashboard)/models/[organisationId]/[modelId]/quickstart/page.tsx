import type { ModelRouteParams } from "@/components/(data)/model/model-route-helpers";
import { redirectLegacyModelSection } from "../redirectLegacyModelSection";

type QuickstartSearchParams = Record<string, string | string[] | undefined>;

export const instant = false;

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<ModelRouteParams>;
	searchParams: Promise<QuickstartSearchParams>;
}) {
	return redirectLegacyModelSection(params, "quickstart", searchParams);
}
