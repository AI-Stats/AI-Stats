export interface GatewayModelLifecycle {
  deprecated_at: string | null;
  message: string | null;
  released_at: string | null;
  replacement_id: string | null;
  retires_at: string | null;
  status: "active" | "deprecated" | "retired" | null;
}
