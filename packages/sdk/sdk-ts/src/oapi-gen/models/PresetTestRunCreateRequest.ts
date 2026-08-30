export interface PresetTestRunCreateRequest {
  baseline_preset_id?: string;
  completed_at?: string;
  config?: {
    [key: string]: unknown;
  };
  dataset_name?: string;
  description?: string;
  name?: string;
  preset_id?: string;
  started_at?: string;
  status?: "pending" | "running" | "completed" | "failed" | "cancelled";
  summary?: {
    [key: string]: unknown;
  };
}
