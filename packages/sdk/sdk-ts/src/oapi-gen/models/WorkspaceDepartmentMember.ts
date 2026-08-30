export interface WorkspaceDepartmentMember {
  department_id: string;
  is_primary: boolean;
  position: "member" | "lead";
  user_id: string;
}
