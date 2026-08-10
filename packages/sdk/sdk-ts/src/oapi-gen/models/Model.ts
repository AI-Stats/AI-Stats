export interface Model {
  aliases: string[];
  availability: {
    active_provider_count: number;
    coming_soon_provider_count: number;
    inactive_provider_count: number;
    provider_count: number;
    status: "active" | "coming_soon" | "inactive" | "not_listed";
  };
  base_model_id: string;
  capabilities: {
    endpoints?: string[];
    parameter_details: {
      [key: string]: {
        [key: string]: unknown;
      };
    };
    parameters: string[];
  };
  description: string;
  id: string;
  lifecycle: {
    deprecated_at: string | null;
    message: string | null;
    released_at: string | null;
    replacement_id: string | null;
    retires_at: string | null;
    status: "active" | "deprecated" | "retired" | null;
  };
  limits: {
    input_tokens: number | null;
    output_tokens: number | null;
  };
  modalities: {
    input: string[];
    output: string[];
  };
  name: string;
  offers: {
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
  }[];
  organization: {
    color: string | null;
    id: string;
    name: string | null;
  } | null;
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
  variant: string;
  variants: {
    [key: string]: {
      model_id: string;
      name: string;
    };
  };
}
