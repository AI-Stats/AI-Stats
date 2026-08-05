import { Suspense } from "react";
import DynamicRoutesStudio from "@/components/(gateway)/settings/routing/DynamicRoutesStudio";
import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import { fetchSettingsDynamicRoutesInitialData } from "@/lib/fetchers/internal/fetchSettingsDynamicRoutesInitialData";

export const metadata = {
	title: "Dynamic Routing - Settings",
};

export default function DynamicRoutingSettingsPage() {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-bold">Dynamic routing</h1>
				<p className="mt-2 text-sm text-muted-foreground">Build request flows and attach them to specific API keys.</p>
			</header>
			<Suspense fallback={<SettingsSectionFallback />}>
				<DynamicRoutesContent />
			</Suspense>
		</div>
	);
}

async function DynamicRoutesContent() {
	const initialData = await fetchSettingsDynamicRoutesInitialData();
	return <DynamicRoutesStudio initialData={initialData} />;
}
