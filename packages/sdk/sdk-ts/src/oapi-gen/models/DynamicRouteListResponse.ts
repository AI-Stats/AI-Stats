export interface DynamicRouteListResponse {
  data: {
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
    created_at?: string | null;
    deployed_version?: number | null;
    description?: string | null;
    id: string;
    key_ids: string[];
    name: string;
    slug: string;
    status: "active" | "paused";
    updated_at?: string | null;
    version: number;
    versions: {
      created_at?: string | null;
      created_by?: string | null;
      status: "draft" | "deployed" | "superseded";
      version: number;
    }[];
    workspace_id: string;
  }[];
  total_count: number;
}
