export interface GatewayFeedbackCreateRequest {
  comment?: string;
  end_user_id?: string;
  metadata?: {
    [key: string]: unknown;
  };
  metadata_dimensions?: {
    [key: string]: unknown;
  };
  preset_id?: string;
  rating?: string;
  reason?: string;
  reason_tags?: string[];
  request_id?: string;
  score?: number;
  session_id?: string;
  source?: "api" | "user" | "system" | "import" | "test";
  test_run_id?: string;
}
