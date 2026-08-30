export interface ObservabilityLoggingPolicyResponse {
  data: {
    billing_status: "active" | "grace" | "suspended";
    enabled: boolean;
    grace_until?: string | null;
    include_provider_payloads: boolean;
    price_per_million_units_nanos: number;
    retention_days: number;
    updated_at?: string | null;
    workspace_id: string;
  };
}
