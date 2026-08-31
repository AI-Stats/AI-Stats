export interface WorkspaceJoinRequestResponse {
  data: {
    created_at?: string;
    decided_at?: string | null;
    decided_by?: string | null;
    id: string;
    invite_id?: string | null;
    requester_user_id: string;
    status: "pending" | "approved" | "denied";
    workspace_id: string;
  };
}
