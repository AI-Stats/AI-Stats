import { Suspense } from "react";
import SettingsSectionFallback from "@/components/(gateway)/settings/SettingsSectionFallback";
import AccountSettingsClient from "@/components/(gateway)/settings/account/AccountSettingsClient";
import SettingsPageHeader from "@/components/(gateway)/settings/SettingsPageHeader";
import { fetchSettingsAccountDetailsInitialData } from "@/lib/fetchers/internal/fetchSettingsAccountDetailsInitialData";
import { getSettingsMessages } from "@/i18n/settings";
import { isPublicLocale, type PublicLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	const messages = getSettingsMessages((isPublicLocale(locale) ? locale : "en-GB") as PublicLocale);
	return { title: `${messages.pages.account} - ${messages.pages.settings}` };
}

export default async function AccountDetailsPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	const messages = getSettingsMessages((isPublicLocale(locale) ? locale : "en-GB") as PublicLocale);
	return (
		<div className="space-y-6">
			<SettingsPageHeader
				title={messages.pages.account}
				description={messages.pages.accountDescription}
			/>
			<Suspense fallback={<SettingsSectionFallback />}>
				<AccountDetailsContent messages={messages} />
			</Suspense>
		</div>
	);
}

async function AccountDetailsContent({ messages }: { messages: ReturnType<typeof getSettingsMessages> }) {
	const initialData = await fetchSettingsAccountDetailsInitialData();

	if (!initialData.user) {
		return (
			<div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
				{messages.pages.notSignedIn}
			</div>
		);
	}

	return (
		<div
			data-obfuscate-pii={initialData.user.obfuscateInfo ? "true" : "false"}
			data-obfuscation-sync="true"
		>
			<AccountSettingsClient
				user={initialData.user}
				teams={initialData.teams}
				hasPassword={initialData.hasPassword}
			/>
		</div>
	);
}
