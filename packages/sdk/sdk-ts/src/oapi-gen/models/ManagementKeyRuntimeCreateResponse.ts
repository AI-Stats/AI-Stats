export interface ManagementKeyRuntimeCreateResponse {
  data: {
    created_at: string;
    created_by?: string | null;
    daily_limit_cost_nanos?: number | null;
    daily_limit_requests?: number | null;
    expires_at?: string | null;
    id: string;
    key: string;
    last_used_at?: string | null;
    monthly_limit_cost_nanos?: number | null;
    monthly_limit_requests?: number | null;
    name: string;
    prefix: string;
    scopes: string[];
    soft_blocked?: boolean | null;
    status: "active" | "paused";
    updated_at?: string | null;
    weekly_limit_cost_nanos?: number | null;
    weekly_limit_requests?: number | null;
    workspace_id: string;
  };
}
