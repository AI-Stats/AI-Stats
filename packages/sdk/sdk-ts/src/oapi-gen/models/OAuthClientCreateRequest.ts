export interface OAuthClientCreateRequest {
  allowed_scopes?: string[];
  client_type?: "public" | "confidential";
  description?: string;
  homepage_url?: string;
  logo_url?: string;
  name: string;
  privacy_policy_url?: string;
  redirect_uris: string[];
  terms_of_service_url?: string;
}
