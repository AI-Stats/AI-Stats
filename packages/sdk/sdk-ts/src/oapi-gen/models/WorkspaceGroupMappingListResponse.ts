export interface WorkspaceGroupMappingListResponse {
  data: {
    access_role: "member" | "admin";
    created_at?: string | null;
    department_id: string;
    department_position: "member" | "lead";
    id: string;
    scim_group_id: string;
    updated_at?: string | null;
  }[];
}
