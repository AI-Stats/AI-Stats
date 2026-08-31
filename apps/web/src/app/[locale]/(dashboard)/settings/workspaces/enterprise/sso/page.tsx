import WorkspaceEnterpriseRoute from "@/components/(gateway)/settings/teams/WorkspaceEnterpriseRoute";

export const metadata = { title: "Single Sign-On - Workspace Settings" };

export default function WorkspaceEnterpriseSsoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <WorkspaceEnterpriseRoute mode="sso" searchParams={searchParams} />;
}
