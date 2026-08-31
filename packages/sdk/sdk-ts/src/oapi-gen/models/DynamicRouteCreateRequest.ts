export interface DynamicRouteCreateRequest {
  config: {
    cacheAwareRouting?: boolean;
    defaultAction?: {
      allowFallbacks?: boolean;
      model?: string;
      modelFallbacks?: string[];
      providerIgnore?: string[];
      providerOnly?: string[];
      providerOrder?: string[];
      routingMode?: "balanced" | "price" | "latency" | "throughput";
    };
    edges?: {
      id: string;
      source: string;
      sourceHandle?: string | null;
      target: string;
    }[];
    entryNodeId?: string | null;
    nodes?: {
      data: {
        [key: string]: unknown;
      };
      id: string;
      position?: {
        x: number;
        y: number;
      } | null;
      type:
        | "start"
        | "condition"
        | "percentage"
        | "model"
        | "rate_limit"
        | "budget_limit"
        | "end";
    }[];
    rules?: {
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
        operator:
          "equals" | "not_equals" | "contains" | "starts_with" | "exists";
        value?: string | null;
      };
      enabled: boolean;
      id: string;
      name: string;
    }[];
    schemaVersion?: 2;
    sessionAffinity?: boolean;
  };
  description?: string | null;
  name: string;
  slug?: string;
  status?: "active" | "paused";
}
