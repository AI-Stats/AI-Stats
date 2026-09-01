export interface GatewayObservabilityEventCreateRequest {
  category?: "feedback" | "behavior" | "outcome" | "app" | "test" | "custom";
  end_user_id?: string;
  event_name: string;
  metadata?: {
    [key: string]: unknown;
  };
  metadata_dimensions?: {
    [key: string]: unknown;
  };
  numeric_value?: number;
  occurred_at?: string;
  preset_id?: string;
  request_id?: string;
  session_id?: string;
  source?: "api" | "user" | "system" | "import" | "test";
  test_run_id?: string;
  value?: unknown;
}
