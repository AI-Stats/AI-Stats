import WorkspaceEnterpriseRoute from "@/components/(gateway)/settings/teams/WorkspaceEnterpriseRoute";

export const metadata = { title: "Enterprise Departments - Workspace Settings" };

export default function WorkspaceEnterpriseDepartmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <WorkspaceEnterpriseRoute mode="departments" searchParams={searchParams} />;
}
