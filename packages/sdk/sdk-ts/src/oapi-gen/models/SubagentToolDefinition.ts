export interface SubagentToolDefinition {
  parameters?: {
    [key: string]: unknown;
  };
  type: "phaseo:subagent";
}
