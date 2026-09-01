export interface KeyInvalidateResponse {
  key: {
    id: string;
    kid?: string | null;
    status?: string | null;
    workspace_id: string;
  };
  message: string;
  ok: true;
}
