export interface WorkspaceBudgetListResponse {
  data: {
    created_at: string;
    created_by?: string | null;
    exceeded: boolean;
    id: string;
    interval: "daily" | "weekly" | "monthly" | "lifetime";
    limit: number;
    limit_nanos: number;
    remaining: number;
    remaining_nanos: number;
    reset_at?: string | null;
    updated_at: string;
    usage: number;
    usage_nanos: number;
    window_start?: string | null;
    workspace_id: string;
  }[];
}
