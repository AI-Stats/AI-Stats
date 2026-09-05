export interface GatewayFeedbackSummaryResponse {
  data: {
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
  }[];
  group_by: "preset_id" | "test_run_id" | "metadata";
}
