export interface ApiKeyRotateRequest {
  new_name?: string;
  previous_key_expires_at?: string | null;
}
