import { Suspense } from "react";
import DynamicRoutesStudio from "@/components/(gateway)/settings/routing/DynamicRoutesStudio";
import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import { ProductFeedbackButton } from "@/components/feedback/ProductFeedbackButton";
import { fetchSettingsDynamicRoutesInitialData } from "@/lib/fetchers/internal/fetchSettingsDynamicRoutesInitialData";

export const metadata = {
	title: "Dynamic Routing - Settings",
};

export default function DynamicRoutingSettingsPage() {
	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h1 className="text-2xl font-bold">Dynamic routing</h1>
					<ProductFeedbackButton
						surface="settings_dynamic_routes"
						prompt="Tell us what is missing or confusing about Dynamic Routes."
					/>
				</div>
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
