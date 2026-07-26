export interface GuardrailMemberAddResponse {
  added_count: number;
  data: {
    display_name?: string | null;
    joined_at?: string | null;
    role?: string | null;
    user_id: string;
  }[];
}
