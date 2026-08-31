import type { Metadata } from "next";
import { Suspense } from "react";
import ModelsPageClient from "@/components/(data)/models/Models/ModelsPageClient";
import { ModelsPageSkeleton } from "@/components/(data)/models/Models/ModelsPageSkeleton";
import { resolveModelsCatalogueVersion } from "@/lib/models/catalogueVersion";
import { getLocale, getTranslations } from "next-intl/server";
import { buildLocalizedPageMetadata } from "@/lib/auth/localized-metadata";

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const t = await getTranslations("Catalogue.models");
	return buildLocalizedPageMetadata({
		locale: locale as never,
		pathname: "/models",
		title: t("title"),
		description: t("description"),
		keywords: ["AI models", "compare AI models", "AI model pricing", "AI benchmarks", "AI providers"],
	});
}

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
