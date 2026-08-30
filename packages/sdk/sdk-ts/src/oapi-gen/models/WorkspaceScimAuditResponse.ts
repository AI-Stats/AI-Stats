export interface WorkspaceScimAuditResponse {
  data: {
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
  }[];
}
