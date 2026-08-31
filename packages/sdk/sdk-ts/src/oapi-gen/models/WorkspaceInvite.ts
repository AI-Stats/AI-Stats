export interface WorkspaceInvite {
  created_at?: string;
  creator_user_id: string;
  expires_at?: string | null;
  id: string;
  max_uses?: number | null;
  role: "admin" | "member";
  token_preview?: string | null;
  uses_count?: number;
  workspace_id: string;
}
