export interface WorkspaceBudgetUpdateInput {
  interval?: "daily" | "weekly" | "monthly" | "lifetime";
  limit?: number;
}
