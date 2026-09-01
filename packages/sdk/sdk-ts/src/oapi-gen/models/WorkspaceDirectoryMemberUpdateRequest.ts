export interface WorkspaceDirectoryMemberUpdateRequest {
  access_role?: "directory" | "admin" | "member" | null;
  department_id?: string | null;
  department_mode?: "directory" | "department" | "none";
  department_position?: "member" | "lead";
}
