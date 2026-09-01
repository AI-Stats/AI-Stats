export interface DynamicRouteVersion {
  created_at?: string | null;
  created_by?: string | null;
  status: "draft" | "deployed" | "superseded";
  version: number;
}
