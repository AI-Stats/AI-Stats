export interface WorkspaceAuditEvent {
  action: string;
  actor?: {
    display_name?: string | null;
    email?: string | null;
  } | null;
  actor_user_id?: string | null;
  created_at: string;
  id: string;
  metadata: {
    accessTemplate?: string;
    changedFields?: string[];
    expiresAt?: string | null;
    limits?: {
      dailyCostNanos?: number;
      dailyRequests?: number;
      monthlyCostNanos?: number;
      monthlyRequests?: number;
      softBlocked?: boolean;
      weeklyCostNanos?: number;
      weeklyRequests?: number;
    };
    prefix?: string | null;
    previousKeyExpiresAt?: string | null;
    replacementKeyId?: string;
    replacementKeyName?: string;
    status?: string;
    [key: string]: unknown;
  };
  request_id?: string | null;
  target_id: string;
  target_name?: string | null;
  target_type: string;
  workspace_id: string;
}
