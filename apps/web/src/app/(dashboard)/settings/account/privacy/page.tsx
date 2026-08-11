import { Suspense } from "react";
import SettingsPageHeader from "@/components/(gateway)/settings/SettingsPageHeader";
import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import AccountPrivacySettingsClient from "@/components/(gateway)/settings/account/AccountPrivacySettingsClient";
import { fetchSettingsAccountPrivacyInitialData } from "@/lib/fetchers/internal/fetchSettingsAccountPrivacyInitialData";

export const metadata = { title: "Privacy - Settings" };

export default function AccountPrivacyPage() {
	return <div className="space-y-6"><SettingsPageHeader title="Personal Data Controls" description="Control data handling and route access for Phaseo Chat and other requests made as you." /><Suspense fallback={<SettingsSectionFallback />}><Content /></Suspense></div>;
}

async function Content() {
	const data = await fetchSettingsAccountPrivacyInitialData();
	if (!data.signedIn) return <p className="text-sm text-muted-foreground">Not signed in.</p>;
	return <AccountPrivacySettingsClient policy={data.policy} providers={data.providers} models={data.models} />;
}
