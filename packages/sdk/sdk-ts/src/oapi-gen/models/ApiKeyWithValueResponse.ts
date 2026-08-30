export interface ApiKeyWithValueResponse {
  data: {
    created_at: string | null;
    created_by: string | null;
    disabled: boolean;
    expires_at: string | null;
    hash: string;
    id: string;
    include_byok_in_limit: false;
    key: string;
    label: string | null;
    last_used_at: string | null;
    limit: number | null;
    limit_reset: "daily" | "weekly" | "monthly" | null;
    name: string | null;
    prefix: string | null;
    scopes: string | string[];
    soft_blocked: boolean;
    status: string | null;
    updated_at: string | null;
    workspace_id: string;
  };
}
