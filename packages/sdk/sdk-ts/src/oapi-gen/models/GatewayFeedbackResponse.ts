export interface GatewayFeedbackResponse {
  data: {
    comment: string | null;
    created_at: string;
    created_by_user_id: string | null;
    end_user_id: string | null;
    id: string;
    metadata: {
      [key: string]: unknown;
    };
    metadata_dimensions: {
      [key: string]: string;
    };
    preset_id: string | null;
    rating: string | null;
    reason: string | null;
    reason_tags: string[];
    request_id: string | null;
    score: number | null;
    session_id: string | null;
    source: "api" | "user" | "system" | "import" | "test";
    test_run_id: string | null;
    workspace_id: string;
  };
}
