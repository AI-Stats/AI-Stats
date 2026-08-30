import type { Metadata } from "next";
import { Suspense } from "react";
import ModelsPageClient from "@/components/(data)/models/Models/ModelsPageClient";
import { ModelsPageSkeleton } from "@/components/(data)/models/Models/ModelsPageSkeleton";
import { resolveModelsCatalogueVersion } from "@/lib/models/catalogueVersion";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Models",
	description:
		"Browse models with an active Phaseo Gateway route by default, then compare providers, modalities, benchmarks, and pricing.",
	path: "/models",
	keywords: [
		"AI models",
		"compare AI models",
		"AI model pricing",
		"AI benchmarks",
		"AI providers",
	],
});

async function ModelsPageContent() {
	return (
		<ModelsPageClient catalogueVersion={await resolveModelsCatalogueVersion()} />
	);
}

export default function ModelsPage() {
	return (
		<Suspense fallback={<ModelsPageSkeleton />}>
			<ModelsPageContent />
		</Suspense>
	);
}
