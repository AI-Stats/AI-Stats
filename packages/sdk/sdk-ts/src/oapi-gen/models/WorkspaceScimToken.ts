export interface WorkspaceScimToken {
  created_at?: string | null;
  expires_at?: string | null;
  id: string;
  label: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  token_prefix: string;
}
