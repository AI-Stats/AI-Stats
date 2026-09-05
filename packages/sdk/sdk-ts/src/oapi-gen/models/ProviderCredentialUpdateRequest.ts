export interface ProviderCredentialUpdateRequest {
  allowed_api_key_ids?: string[];
  allowed_models?: string[];
  enabled?: boolean;
  key?: string;
  name?: string;
  routing_mode?: "priority" | "fallback";
}
