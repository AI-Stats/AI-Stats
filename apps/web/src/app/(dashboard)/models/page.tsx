import type { Metadata } from "next";
import ModelsPageClient from "@/components/(data)/models/Models/ModelsPageClient";
import { resolveModelsCatalogueVersion } from "@/lib/models/catalogueVersion";
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
	return (
		<ModelsPageClient catalogueVersion={await resolveModelsCatalogueVersion()} />
	);
}
