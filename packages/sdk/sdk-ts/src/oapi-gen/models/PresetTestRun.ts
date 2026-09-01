export interface PresetTestRun {
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
}
