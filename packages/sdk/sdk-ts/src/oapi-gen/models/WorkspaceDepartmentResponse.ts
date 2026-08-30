export interface WorkspaceDepartmentResponse {
  data: {
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
  };
}
