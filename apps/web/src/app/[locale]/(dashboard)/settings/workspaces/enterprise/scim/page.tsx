import WorkspaceEnterpriseRoute from "@/components/(gateway)/settings/teams/WorkspaceEnterpriseRoute";

export const metadata = { title: "SCIM Provisioning - Workspace Settings" };

export default function WorkspaceEnterpriseScimPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <WorkspaceEnterpriseRoute mode="scim" searchParams={searchParams} />;
}
