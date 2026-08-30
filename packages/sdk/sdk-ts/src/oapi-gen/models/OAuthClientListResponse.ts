export interface OAuthClientListResponse {
  data: {
    active_authorizations?: number;
    allowed_scopes?: string[];
    client_id: string;
    client_type: "public" | "confidential";
    created_at?: string | null;
    description?: string | null;
    homepage_url?: string | null;
    last_used_at?: string | null;
    logo_url?: string | null;
    name: string;
    privacy_policy_url?: string | null;
    redirect_uris: string[];
    requests_last_30d?: number;
    status: string;
    terms_of_service_url?: string | null;
    total_authorizations?: number;
    updated_at?: string | null;
    workspace_id: string;
    [key: string]: unknown;
  }[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}
