export interface WorkspaceBudgetInput {
  interval: "daily" | "weekly" | "monthly" | "lifetime";
  limit: number;
}
