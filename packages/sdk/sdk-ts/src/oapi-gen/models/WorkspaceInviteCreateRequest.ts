export interface WorkspaceInviteCreateRequest {
  expires_in_days?: number;
  max_uses?: number | null;
  role?: "admin" | "member";
}
