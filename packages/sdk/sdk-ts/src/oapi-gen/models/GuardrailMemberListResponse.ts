export interface GuardrailMemberListResponse {
  data: {
    display_name?: string | null;
    joined_at?: string | null;
    role?: string | null;
    user_id: string;
  }[];
  total_count: number;
}
