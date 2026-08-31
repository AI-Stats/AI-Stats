export interface ObservabilityRuleGroup {
  match: "and" | "or";
  rules: {
    condition:
      | "equals"
      | "not_equals"
      | "contains"
      | "not_contains"
      | "starts_with"
      | "ends_with"
      | "exists"
      | "not_exists"
      | "matches_regex";
    field:
      | "model"
      | "provider"
      | "session_id"
      | "user_id"
      | "api_key_name"
      | "finish_reason"
      | "input"
      | "output"
      | "token_cost"
      | "total_cost"
      | "total_tokens"
      | "prompt_tokens"
      | "completion_tokens";
    value?: string | null;
  }[];
}
