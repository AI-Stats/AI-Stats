export interface WorkspaceAutoTopUpSettings {
  amount_nanos: number;
  balance_threshold_nanos: number;
  enabled: boolean;
  payment_method_id: string | null;
}
