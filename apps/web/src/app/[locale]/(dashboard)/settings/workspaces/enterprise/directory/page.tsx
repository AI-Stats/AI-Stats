import WorkspaceEnterpriseRoute from "@/components/(gateway)/settings/teams/WorkspaceEnterpriseRoute";

export const metadata = { title: "Enterprise Directory - Workspace Settings" };

export default function WorkspaceEnterpriseDirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <WorkspaceEnterpriseRoute mode="directory" searchParams={searchParams} />;
}
