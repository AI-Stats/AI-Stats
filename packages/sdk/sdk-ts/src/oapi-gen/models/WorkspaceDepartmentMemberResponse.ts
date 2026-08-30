export interface WorkspaceDepartmentMemberResponse {
  data: {
    department_id: string;
    is_primary: boolean;
    position: "member" | "lead";
    user_id: string;
  };
}
