export interface WorkspaceDirectoryMember {
  access_source: string;
  department: {
    color?: string;
    created_at?: string | null;
    description?: string | null;
    directory_name?: string | null;
    icon?: string;
    id: string;
    name: string;
    name_overridden?: boolean;
    source_id?: string | null;
    source_type?: "manual" | "scim_group";
    updated_at?: string | null;
  } | null;
  department_override_enabled: boolean;
  department_override_id: string | null;
  department_source: string;
  directory_department?: string | null;
  display_name: string;
  effective_role: "owner" | "admin" | "member";
  email?: string | null;
  joined_at?: string | null;
  role_override: "admin" | "member" | null;
  status: "active" | "suspended";
  user_id: string;
  workspace_role: string;
}
