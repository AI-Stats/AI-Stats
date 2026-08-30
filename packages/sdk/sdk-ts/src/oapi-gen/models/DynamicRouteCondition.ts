export interface DynamicRouteCondition {
  field: "always" | "endpoint" | "model" | "session_id" | "metadata";
  metadataKey?: string | null;
  operator: "equals" | "not_equals" | "contains" | "starts_with" | "exists";
  value?: string | null;
}
