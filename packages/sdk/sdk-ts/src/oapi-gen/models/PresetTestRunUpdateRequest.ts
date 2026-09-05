export interface PresetTestRunUpdateRequest {
  completed_at?: string | null;
  description?: string | null;
  name?: string | null;
  started_at?: string | null;
  status?: "pending" | "running" | "completed" | "failed" | "cancelled";
  summary?: {
    [key: string]: unknown;
  };
}
