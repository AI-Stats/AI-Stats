import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import SettingsPageHeader from "@/components/(gateway)/settings/SettingsPageHeader";
import { Badge } from "@/components/ui/badge";
import { enterpriseSelfServePreviewEnabled } from "@/lib/flags";
import { fetchSettingsTeamsInitialData } from "@/lib/fetchers/internal/fetchSettingsTeamsInitialData";
import WorkspaceIdentitySettings from "./WorkspaceIdentitySettings";
import WorkspaceEnterpriseDirectory from "./WorkspaceEnterpriseDirectory";

type Mode = "overview" | "directory" | "departments" | "sso" | "scim";
type SearchParams = Record<string, string | string[] | undefined>;

export default async function WorkspaceEnterpriseRoute({ mode, searchParams }: { mode: Mode; searchParams: Promise<SearchParams> }) {
	const t = await getTranslations("SettingsUI");
	await connection();
	if (!(await enterpriseSelfServePreviewEnabled())) notFound();
	const params = await searchParams;
	const preferredWorkspaceId = Array.isArray(params.workspaceId) ? params.workspaceId[0] : params.workspaceId;
	const data = await fetchSettingsTeamsInitialData(preferredWorkspaceId);
	const workspaceId = data.initialTeamId ?? null;
	const titleKey = mode === "overview" ? "headers.enterprise" : mode === "directory" ? "headers.directory" : mode === "departments" ? "headers.departments" : mode === "sso" ? "headers.singleSignOn" : "headers.scim";
	const descriptionKey = mode === "overview" ? "headers.enterpriseOverviewDescription" : mode === "directory" ? "headers.directoryDescription" : mode === "departments" ? "headers.departmentsDescription" : mode === "sso" ? "headers.ssoDescription" : "headers.scimDescription";
	const canEdit = Boolean(workspaceId && data.manageableTeamIds?.includes(workspaceId));
	const memberCount = workspaceId ? (data.membersByTeam?.[workspaceId]?.length ?? 0) : 0;

	if (!workspaceId || workspaceId === data.personalTeamId) {
		return (
			<div className="space-y-6">
				<SettingsPageHeader title={t(titleKey as never)} description={t(descriptionKey as never)} />
				<section className="border-y border-border/60 py-5"><p className="text-sm font-medium">{t("headers.chooseSharedWorkspace")}</p><p className="mt-1 text-sm text-muted-foreground">{t("headers.sharedWorkspaceRequired")}</p></section>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<SettingsPageHeader title={t(titleKey as never)} description={t(descriptionKey as never)} meta={mode === "directory" ? <Badge variant="secondary">{t("headers.membersCount", { count: memberCount })}</Badge> : undefined} />
			{mode === "directory" || mode === "departments" ? <WorkspaceEnterpriseDirectory
				mode={mode}
				workspaceId={workspaceId}
				members={data.membersByTeam?.[workspaceId] ?? []}
				currentUserId={data.currentUserId}
				canEdit={canEdit}
			/> : <WorkspaceIdentitySettings
				workspaceId={workspaceId}
				initialSettings={data.teamSsoSettingsByTeam?.[workspaceId]}
				canEdit={canEdit}
				canConfigureEnterprise
				mode={mode}
			/>}
		</div>
	);
}
