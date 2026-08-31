export interface GatewayObservabilityEventResponse {
  data: {
    category: "feedback" | "behavior" | "outcome" | "app" | "test" | "custom";
    created_at: string;
    created_by_user_id: string | null;
    end_user_id: string | null;
    event_name: string;
    id: string;
    metadata: {
      [key: string]: unknown;
    };
    metadata_dimensions: {
      [key: string]: string;
    };
    numeric_value: number | null;
    occurred_at: string;
    preset_id: string | null;
    request_id: string | null;
    session_id: string | null;
    source: "api" | "user" | "system" | "import" | "test";
    test_run_id: string | null;
    value: unknown | null;
    workspace_id: string;
  };
}
