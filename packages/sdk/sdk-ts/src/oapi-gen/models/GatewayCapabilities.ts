export interface GatewayCapabilities {
  endpoints?: string[];
  parameter_details: {
    [key: string]: {
      [key: string]: unknown;
    };
  };
  parameters: string[];
}
