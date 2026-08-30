export interface WorkspaceAppMergeResponse {
  data: {
    merged: true;
    source_app_id: string;
    target_app_id: string;
  };
}
