export interface GatewayModelOffer {
  capabilities: {
    endpoints?: string[];
    parameter_details: {
      [key: string]: {
        [key: string]: unknown;
      };
    };
    parameters: string[];
  };
  effective: {
    from: string | null;
    to: string | null;
  };
  endpoints: string[];
  modalities: {
    input: string[];
    output: string[];
  };
  model: string | null;
  pricing: {
    meters: {
      [key: string]: {
        currency: string | null;
        price_per_unit: string;
        provider_id: string;
        unit: string;
        unit_size: number;
      } | null;
    };
    pricing_plan: "standard";
  };
  provider: {
    id: string;
    name: string | null;
  };
  routable: boolean;
  routing: {
    capability: string;
    model: string;
    provider: string;
  };
  status: "active" | "coming_soon" | "inactive";
  status_reason: string;
}
