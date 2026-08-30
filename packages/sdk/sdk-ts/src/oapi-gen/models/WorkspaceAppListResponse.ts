export interface WorkspaceAppListResponse {
  data: {
    app_key: string;
    category: string | null;
    created_at: string | null;
    docs_url: string | null;
    id: string;
    image_url: string | null;
    is_active: boolean;
    is_managed: boolean;
    is_public: boolean;
    last_seen: string | null;
    title: string;
    url: string | null;
  }[];
}
