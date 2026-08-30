export interface WorkspaceNotificationDestinationListResponse {
  data: {
    created_at?: string | null;
    id: string;
    name: string;
    status: "active" | "disabled";
    target_preview: string;
    type:
      | "email"
      | "discord"
      | "discord_webhook"
      | "slack"
      | "microsoft_teams"
      | "custom_webhook";
    updated_at?: string | null;
  }[];
}
