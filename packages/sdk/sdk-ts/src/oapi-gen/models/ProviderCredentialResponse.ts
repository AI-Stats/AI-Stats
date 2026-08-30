export interface ProviderCredentialResponse {
  data: {
    allowed_api_key_ids?: string[];
    allowed_model_slugs?: string[];
    always_use?: boolean;
    created_at?: string | null;
    created_by?: string | null;
    disabled: boolean;
    enabled: boolean;
    error_message?: string | null;
    id: string;
    is_fallback: boolean;
    last_used_at?: string | null;
    last_verified_at?: string | null;
    name: string;
    prefix?: string | null;
    provider_id: string;
    routing_mode: "priority" | "fallback";
    sort_order: number;
    suffix?: string | null;
    verification_status?: string | null;
    workspace_id: string;
  };
}
