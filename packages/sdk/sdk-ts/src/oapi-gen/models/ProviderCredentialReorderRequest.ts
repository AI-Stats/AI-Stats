export interface ProviderCredentialReorderRequest {
  key_ids: string[];
  provider: string;
  routing_mode: "priority" | "fallback";
}
