export interface WorkspaceScimResponse {
  data: {
    endpoint: {
      created_at?: string | null;
      enabled: boolean;
      id: string;
      updated_at?: string | null;
    } | null;
    group_count: number;
    last_event: {
      action?: string;
      correlation_id?: string | null;
      created_at?: string;
      detail?: {
        [key: string]: unknown;
      } | null;
      http_status?: number;
      id?: string;
      outcome?: string;
      request_id?: string | null;
      resource_id?: string | null;
      resource_type?: string | null;
      scim_type?: string | null;
    } | null;
    tokens: {
      created_at?: string | null;
      expires_at?: string | null;
      id: string;
      label: string;
      last_used_at?: string | null;
      revoked_at?: string | null;
      token_prefix: string;
    }[];
    user_count: number;
  };
}
