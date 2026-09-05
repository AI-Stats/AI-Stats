export interface WorkspaceScimTokenCreateResponse {
  data: {
    created_at?: string | null;
    expires_at?: string | null;
    id: string;
    label: string;
    last_used_at?: string | null;
    revoked_at?: string | null;
    token: string;
    token_prefix: string;
  };
}
