/**
 * Provide exactly one of `template` or `scopes`.
 */
export interface ManagementKeyRuntimeCreateRequest {
  expires_at?: string | null;
  name: string;
  paused?: boolean;
  scopes?: string | string[];
  template?: "read-only" | "read-write" | "full-control";
}
