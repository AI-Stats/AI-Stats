export interface GuardrailUpdateRequest {
  allowedApiModelIds?: string[];
  budgets?: {
    dailyCostNanos?: number | null;
    dailyRequests?: number | null;
    monthlyCostNanos?: number | null;
    monthlyRequests?: number | null;
    weeklyCostNanos?: number | null;
    weeklyRequests?: number | null;
  };
  description?: string | null;
  enabled?: boolean;
  modelRestrictionMode?: "none" | "allowlist" | "blocklist";
  name?: string;
  privacyEnableFreeMayPublishPrompts?: boolean | null;
  privacyEnableFreeMayTrain?: boolean | null;
  privacyEnableInputOutputLogging?: boolean | null;
  privacyEnablePaidMayTrain?: boolean | null;
  privacyZdrOnly?: boolean | null;
  promptInjectionAction?: "flag" | "block";
  promptInjectionEnabled?: boolean;
  providerRestrictionEnforceAllowed?: boolean;
  providerRestrictionMode?: "none" | "allowlist" | "blocklist";
  providerRestrictionProviderIds?: string[];
  sensitiveInfoDefaultAction?: "flag" | "redact" | "block";
  sensitiveInfoEnabled?: boolean;
  sensitiveInfoRules?: {
    [key: string]: unknown;
  }[];
}
