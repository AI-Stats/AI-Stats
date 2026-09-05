export interface GatewayRequestLogResponse {
  data: {
    auth_method?: string | null;
    byok?: boolean | null;
    canonical_model_id?: string | null;
    cost_nanos?: number | null;
    created_at?: string;
    currency?: string | null;
    endpoint?: string | null;
    error_code?: string | null;
    finish_reason?: string | null;
    generation_ms?: number | null;
    key_id?: string | null;
    latency_ms?: number | null;
    location?: string | null;
    model_id?: string | null;
    native_response_id?: string | null;
    oauth_client_id?: string | null;
    pricing_lines?:
      | {
          [key: string]: unknown;
        }[]
      | null;
    provider?: string | null;
    request_id?: string;
    requested_model_id?: string | null;
    routed_model_id?: string | null;
    status_code?: number | null;
    stream?: boolean | null;
    success?: boolean | null;
    throughput?: number | null;
    usage?: {
      [key: string]: unknown;
    } | null;
  };
  ok: true;
}
