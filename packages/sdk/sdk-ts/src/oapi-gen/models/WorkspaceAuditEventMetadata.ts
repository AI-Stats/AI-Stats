export interface WorkspaceAuditEventMetadata {
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
}
