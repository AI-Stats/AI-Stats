export interface WorkspaceNotificationDestinationTestRequest {
  target: string;
  type:
    | "email"
    | "discord"
    | "discord_webhook"
    | "slack"
    | "microsoft_teams"
    | "custom_webhook";
}
