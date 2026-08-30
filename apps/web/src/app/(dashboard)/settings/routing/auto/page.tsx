import { Suspense } from "react";
import AutoRoutingSettingsClient from "@/components/(gateway)/settings/routing/AutoRoutingSettingsClient";
import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import SettingsPageHeader from "@/components/(gateway)/settings/SettingsPageHeader";
import { ProductFeedbackButton } from "@/components/feedback/ProductFeedbackButton";
import { fetchSettingsAutoRoutingInitialData } from "@/lib/fetchers/internal/fetchSettingsAutoRoutingInitialData";

export const metadata = {
	title: "Auto Routing - Settings",
};

export default function AutoRoutingSettingsPage() {
	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<SettingsPageHeader
					title="Auto Routing"
					description="Choose the workspace model pool used when requests select phaseo/auto."
				/>
				<ProductFeedbackButton
					surface="settings_auto_routing"
					prompt="Tell us what is missing or confusing about Auto Routing."
				/>
			</div>
			<Suspense fallback={<SettingsSectionFallback />}>
				<AutoRoutingContent />
			</Suspense>
		</div>
	);
}

async function AutoRoutingContent() {
	const initialData = await fetchSettingsAutoRoutingInitialData();
	if (!initialData.workspaceId) {
		return (
			<div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
				Select a workspace to configure Auto Routing.
			</div>
		);
	}
	return <AutoRoutingSettingsClient initialData={initialData} />;
}
