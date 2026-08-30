export interface PresetTestRunDetailResponse {
  data: {
    baseline_preset_id: string | null;
    completed_at: string | null;
    config: {
      [key: string]: unknown;
    };
    created_at: string;
    created_by_user_id: string | null;
    dataset_name: string | null;
    description: string | null;
    id: string;
    name: string | null;
    preset_id: string | null;
    started_at: string | null;
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    summary: {
      [key: string]: unknown;
    };
    updated_at: string;
    workspace_id: string;
  };
  feedback_summary: {
    average_score: number | null;
    count: number;
    last_feedback_at: string | null;
    metadata_key?: string;
    metadata_value?: string | null;
    negative: number;
    partial: number;
    positive: number;
    preset_id?: string | null;
    ratings: {
      [key: string]: number;
    };
    test_run_id?: string | null;
  } | null;
}
