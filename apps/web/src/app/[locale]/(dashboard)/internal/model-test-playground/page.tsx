import { requireInternalAdmin } from "@/lib/auth/requireInternalAdmin";
import { fetchFrontendGatewayModels } from "@/lib/fetchers/frontend/fetchFrontendGatewayModels";
import ModelTestPlaygroundClient from "./ModelTestPlaygroundClient";

export const metadata = {
	title: "Model Test Lab - Internal",
	description: "Run provider coverage and parameter compatibility tests against Phaseo Gateway.",
};

export default async function ModelTestPlaygroundPage() {
	await requireInternalAdmin();
	const models = await fetchFrontendGatewayModels();
	return <ModelTestPlaygroundClient models={models} />;
}
