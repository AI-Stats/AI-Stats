import type { Metadata } from "next";
import ModelsPageClient from "@/components/(data)/models/Models/ModelsPageClient";
import { isAdminViewer } from "@/lib/auth/getViewerRole";
import { modelsCatalogueV2Flag } from "@/lib/flags";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Models",
	description:
		"Browse AI models by benchmark scores, providers, modalities and pricing to find the right model for your use case.",
	path: "/models",
	keywords: [
		"AI models",
		"compare AI models",
		"AI model pricing",
		"AI benchmarks",
		"AI providers",
	],
});

export default async function ModelsPage() {
	const isAdmin = await isAdminViewer();
	const catalogueVersion =
		isAdmin && (await modelsCatalogueV2Flag()) ? "v2" : "v1";

	return <ModelsPageClient catalogueVersion={catalogueVersion} />;
}
