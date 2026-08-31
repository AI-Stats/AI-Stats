export interface WorkspaceMemberResponse {
  data: {
    display_name?: string | null;
    joined_at?: string | null;
    role: "owner" | "admin" | "member";
    user_id: string;
    workspace_id: string;
  };
}
