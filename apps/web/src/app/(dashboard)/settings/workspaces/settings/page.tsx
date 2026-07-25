import TeamsSettingsContainer from "@/components/(gateway)/settings/teams/TeamsSettingsContainer";
import { fetchSettingsTeamsInitialData } from "@/lib/fetchers/internal/fetchSettingsTeamsInitialData";
import { samlSsoFlag } from "@/lib/flags";

export const metadata = {
	title: "Workspace Settings - Settings",
};

export default async function WorkspaceSettingsPage() {
	const [data, ssoEnabled] = await Promise.all([
		fetchSettingsTeamsInitialData(),
		samlSsoFlag(),
	]);

	return (
		<TeamsSettingsContainer
			teams={data.teams}
			membersByTeam={data.membersByTeam}
			invitesByTeam={data.invitesByTeam}
			requestsByTeam={data.requestsByTeam}
			initialTeamId={data.initialTeamId}
			currentUserId={data.currentUserId}
			personalTeamId={data.personalTeamId}
			manageableTeamIds={data.manageableTeamIds}
			walletBalances={data.walletBalances}
			teamSsoSettingsByTeam={data.teamSsoSettingsByTeam}
			samlSsoEnabled={ssoEnabled}
			tab="settings"
		/>
	);
}
