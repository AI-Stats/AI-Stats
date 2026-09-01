export interface GuardrailKeyListResponse {
  data: {
    created_at?: string | null;
    key_id: string;
    name?: string | null;
    prefix?: string | null;
    status?: string | null;
  }[];
  total_count: number;
}
