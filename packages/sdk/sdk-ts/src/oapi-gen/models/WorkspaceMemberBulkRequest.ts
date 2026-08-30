export interface WorkspaceMemberBulkRequest {
  role?: "admin" | "member";
  user_ids: string[];
}
