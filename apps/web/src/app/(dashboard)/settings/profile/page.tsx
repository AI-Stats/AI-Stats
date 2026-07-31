import { redirect } from "next/navigation"

import ProfileDashboard from "@/components/(gateway)/settings/profile/ProfileDashboard"
import ProfileShareControls from "@/components/(gateway)/settings/profile/ProfileShareControls"
import { ProfileGames } from "@/components/(gateway)/settings/profile/ProfileGames"
import { fetchSettingsProfileGames } from "@/lib/fetchers/internal/fetchSettingsProfileGames"
import { fetchSettingsProfileInitialData } from "@/lib/fetchers/internal/fetchSettingsProfileInitialData"
import { fetchSettingsProfileUsageSummary } from "@/lib/fetchers/internal/fetchSettingsProfileUsageSummary"
import { buildProfileShareCardPayload } from "@/lib/profileShare"

export const metadata = {
	title: "Profile - Settings",
}

export default async function ProfileSettingsPage() {
	const [{ profile: profileIdentity, obfuscateInfo }, { usage }, { games }] = await Promise.all([
		fetchSettingsProfileInitialData(),
		fetchSettingsProfileUsageSummary(),
		fetchSettingsProfileGames(),
	])

	if (!profileIdentity) {
		redirect("/sign-in")
	}
	const profile = usage ? { ...profileIdentity, ...usage } : profileIdentity

	const sharePayload = buildProfileShareCardPayload(profile)

	return (
		<div
			className="space-y-6"
			data-obfuscate-pii={obfuscateInfo ? "true" : "false"}
			data-obfuscation-sync="true"
		>
			<ProfileDashboard
				profile={profile}
				actions={<ProfileShareControls payload={sharePayload} />}
			/>
			<ProfileGames summary={games} />
		</div>
	)
}
