export interface WorkspaceGroupMappingCreateRequest {
  access_role?: "member" | "admin";
  department_id: string;
  department_position?: "member" | "lead";
  scim_group_id: string;
}
