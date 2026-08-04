import { Suspense } from "react";
import RoutingInsights from "@/components/(gateway)/settings/routing/RoutingInsights";
import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import { fetchSettingsDynamicRoutesInitialData } from "@/lib/fetchers/internal/fetchSettingsDynamicRoutesInitialData";

export const metadata = {
	title: "Routing Insights - Settings",
};

export default function RoutingInsightsPage() {
	return <Suspense fallback={<SettingsSectionFallback />}><RoutingInsightsContent /></Suspense>;
}

async function RoutingInsightsContent() {
	const initialData = await fetchSettingsDynamicRoutesInitialData();
	return <RoutingInsights suggestions={initialData.suggestions} />;
}
