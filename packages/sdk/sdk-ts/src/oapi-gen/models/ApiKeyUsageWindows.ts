export interface ApiKeyUsageWindows {
  daily: {
    cost: number;
    requests: number;
  };
  monthly: {
    cost: number;
    requests: number;
  };
  total: {
    cost: number;
    requests: number;
  };
  weekly: {
    cost: number;
    requests: number;
  };
}
