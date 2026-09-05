export interface DynamicRouteRule {
  action: {
    allowFallbacks?: boolean;
    model?: string;
    modelFallbacks?: string[];
    providerIgnore?: string[];
    providerOnly?: string[];
    providerOrder?: string[];
    routingMode?: "balanced" | "price" | "latency" | "throughput";
  };
  condition: {
    field: "always" | "endpoint" | "model" | "session_id" | "metadata";
    metadataKey?: string | null;
    operator: "equals" | "not_equals" | "contains" | "starts_with" | "exists";
    value?: string | null;
  };
  enabled: boolean;
  id: string;
  name: string;
}
