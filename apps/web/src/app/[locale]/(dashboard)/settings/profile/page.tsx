import { redirect } from "next/navigation"

import ProfileDashboard from "@/components/(gateway)/settings/profile/ProfileDashboard"
import { ProfileGames } from "@/components/(gateway)/settings/profile/ProfileGames"
import { fetchSettingsProfileGames } from "@/lib/fetchers/internal/fetchSettingsProfileGames"
import { fetchSettingsProfileInitialData } from "@/lib/fetchers/internal/fetchSettingsProfileInitialData"
import { fetchSettingsProfileUsageSummary } from "@/lib/fetchers/internal/fetchSettingsProfileUsageSummary"
import { catalogueGamesEnabled } from "@/lib/games/preview"
import { getSettingsMessages } from "@/i18n/settings"
import { isPublicLocale, type PublicLocale } from "@/i18n/routing"
import { getProfileMessages } from "@/i18n/profile"
import { localizeAuthPath } from "@/lib/auth/localized-paths"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params
	const messages = getSettingsMessages((isPublicLocale(locale) ? locale : "en-GB") as PublicLocale)
	return { title: `${messages.pages.profile} - ${messages.pages.settings}` }
}

export default async function ProfileSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params
	const profileMessages = getProfileMessages((isPublicLocale(locale) ? locale : "en-GB") as PublicLocale)
	const gamesEnabled = await catalogueGamesEnabled()
	const [{ profile: profileIdentity, obfuscateInfo }, { usage }, { games }] = await Promise.all([
		fetchSettingsProfileInitialData(),
		fetchSettingsProfileUsageSummary(),
		gamesEnabled ? fetchSettingsProfileGames() : Promise.resolve({ games: null }),
	])

	if (!profileIdentity) {
		redirect(localizeAuthPath((isPublicLocale(locale) ? locale : "en-GB") as PublicLocale, "/sign-in"))
	}
	const profile = usage ? { ...profileIdentity, ...usage } : profileIdentity

	return (
		<div
			className="space-y-6"
			data-obfuscate-pii={obfuscateInfo ? "true" : "false"}
			data-obfuscation-sync="true"
		>
			<ProfileDashboard profile={profile} locale={locale} labels={profileMessages} />
			{gamesEnabled ? <ProfileGames summary={games} /> : null}
		</div>
	)
}
