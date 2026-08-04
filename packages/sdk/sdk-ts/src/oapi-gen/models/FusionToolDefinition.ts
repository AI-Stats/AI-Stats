export interface FusionToolDefinition {
  parameters?: {
    analysis_models: string[];
    model?: string;
    [key: string]: unknown;
  };
  type: "phaseo:fusion";
}
