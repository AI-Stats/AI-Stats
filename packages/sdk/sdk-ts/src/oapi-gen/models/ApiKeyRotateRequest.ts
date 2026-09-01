export interface ApiKeyRotateRequest {
  name?: string;
  previous_key_expires_at?: string | null;
}
