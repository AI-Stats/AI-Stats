import { MonitorHistoryClient } from "@/components/monitor/MonitorHistoryClient";
import { fetchFrontendMonitorHistoryInitialData } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { buildLocalizedPageMetadata } from "@/lib/auth/localized-metadata";

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const t = await getTranslations("Catalogue.monitor");
	return buildLocalizedPageMetadata({
		locale: locale as never,
		pathname: "/monitor",
		title: t("title"),
		description: t("description"),
		keywords: ["AI model changes", "AI updates", "AI pricing changes", "Phaseo monitor"],
	});
}

async function MonitorHistorySection() {
	const initialData = await fetchFrontendMonitorHistoryInitialData();

	return (
		<MonitorHistoryClient
			initialPage={initialData.initialPage}
			modelOptions={initialData.modelOptions}
			providerOptions={initialData.providerOptions}
		/>
	);
}

export default function MonitorPage() {
	return (
		<div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
			<MonitorHistorySection />
		</div>
	);
}
