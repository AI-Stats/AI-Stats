export interface DynamicRouteAction {
  allowFallbacks?: boolean;
  model?: string;
  modelFallbacks?: string[];
  providerIgnore?: string[];
  providerOnly?: string[];
  providerOrder?: string[];
  routingMode?: "balanced" | "price" | "latency" | "throughput";
}
