import WorkspaceEnterpriseRoute from "@/components/(gateway)/settings/teams/WorkspaceEnterpriseRoute";

export const metadata = { title: "Enterprise - Workspace Settings" };

export default function WorkspaceEnterprisePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <WorkspaceEnterpriseRoute mode="overview" searchParams={searchParams} />;
}
