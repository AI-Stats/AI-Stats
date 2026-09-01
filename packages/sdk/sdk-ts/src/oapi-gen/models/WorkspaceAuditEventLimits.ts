export interface WorkspaceAuditEventLimits {
  dailyCostNanos?: number;
  dailyRequests?: number;
  monthlyCostNanos?: number;
  monthlyRequests?: number;
  softBlocked?: boolean;
  weeklyCostNanos?: number;
  weeklyRequests?: number;
}
