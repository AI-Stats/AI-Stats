export interface ManagementKeyRuntimeUpdateRequest {
  dailyCostNanos?: number | null;
  dailyRequests?: number | null;
  expires_at?: string | null;
  monthlyCostNanos?: number | null;
  monthlyRequests?: number | null;
  name?: string;
  paused?: boolean;
  scopes?: string | string[];
  softBlocked?: boolean;
  template?: "read-only" | "read-write" | "full-control";
  weeklyCostNanos?: number | null;
  weeklyRequests?: number | null;
}
