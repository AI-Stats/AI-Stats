export interface WorkspaceSsoResponse {
  data: {
    domains: string[];
    enabled: boolean;
    enforced: false;
    mode: "none" | "saml" | "custom_oidc";
    provider_identifier: string | null;
  };
}
