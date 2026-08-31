export interface GuardrailKeyAddResponse {
  added_count: number;
  data: {
    created_at?: string | null;
    key_id: string;
    name?: string | null;
    prefix?: string | null;
    status?: string | null;
  }[];
}
