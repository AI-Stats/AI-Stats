export interface DynamicRouteNode {
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
}
