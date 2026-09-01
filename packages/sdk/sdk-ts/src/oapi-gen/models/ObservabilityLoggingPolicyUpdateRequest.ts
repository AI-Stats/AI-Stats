export interface ObservabilityLoggingPolicyUpdateRequest {
  enabled?: boolean;
  include_provider_payloads?: boolean;
  retention_days?: number;
}
