import { Badge } from "@/components/ui/badge";
import SettingsPageHeader from "@/components/(gateway)/settings/SettingsPageHeader";
import BetaSettingsClient from "@/components/(gateway)/settings/beta/BetaSettingsClient";
import {
	WEB_BETA_FEATURES,
	type WebBetaFeatureDefinition,
} from "@/lib/statsig/shared";
import { fetchSettingsBetaInitialData } from "@/lib/fetchers/internal/fetchSettingsBetaInitialData";
import { getBetaMessages } from "@/i18n/beta";
import { isPublicLocale, type PublicLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	return { title: getBetaMessages((isPublicLocale(locale) ? locale : "en-GB") as PublicLocale).title };
}

export default async function BetaSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	const messages = getBetaMessages((isPublicLocale(locale) ? locale : "en-GB") as PublicLocale);
	const initialData = await fetchSettingsBetaInitialData();
	const betaFeatures: readonly WebBetaFeatureDefinition[] = WEB_BETA_FEATURES.filter(
		(feature) =>
			(feature as WebBetaFeatureDefinition).selfService !== false &&
			(!feature.adminOnly || initialData.isAdmin),
	);

	if (!initialData.signedIn) {
		return (
			<div className="space-y-6">
				<SettingsPageHeader
					title={messages.title}
					description={messages.description}
					meta={<Badge variant="outline">{messages.badge}</Badge>}
				/>
				<div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
					{messages.notSignedIn}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<SettingsPageHeader
				title={messages.title}
				description={messages.description}
				meta={<Badge variant="outline">{messages.badge}</Badge>}
			/>
			{betaFeatures.length === 0 ? (
				<div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
					{messages.empty}
				</div>
			) : (
				<BetaSettingsClient
					initialProfile={initialData.profile}
					features={betaFeatures}
				/>
			)}
		</div>
	);
}
