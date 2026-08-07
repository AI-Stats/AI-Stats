import type { ModelRouteParams } from "@/components/(data)/model/model-route-helpers";
import { redirectLegacyModelSection } from "../redirectLegacyModelSection";

export const instant = false;

export default async function Page({
	params,
}: {
	params: Promise<ModelRouteParams>;
}) {
	return redirectLegacyModelSection(params, "about");
}
