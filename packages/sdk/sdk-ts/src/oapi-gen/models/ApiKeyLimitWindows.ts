export interface ApiKeyLimitWindows {
  daily: {
    cost: number | null;
    requests: number | null;
  };
  monthly: {
    cost: number | null;
    requests: number | null;
  };
  weekly: {
    cost: number | null;
    requests: number | null;
  };
}
