export interface ModelEndpointsResponse {
  availability_mode: "active" | "all";
  description: string;
  endpoints: {
    capabilities: {
      endpoints?: string[];
      parameter_details: {
        [key: string]: {
          [key: string]: unknown;
        };
      };
      parameters: string[];
    };
    capability_id: string;
    collection:
      | "text"
      | "images"
      | "video"
      | "audio"
      | "embeddings"
      | "rerank"
      | "moderation"
      | "ocr"
      | "music"
      | "batch"
      | "files";
    effective: {
      from: string | null;
      to: string | null;
    };
    endpoint: string;
    id: string;
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
    public_path: string;
    routable: boolean;
    routing: {
      capability: string;
      model: string;
      provider: string;
    };
    status: "active" | "coming_soon" | "inactive";
    status_reason: string;
  }[];
  id: string;
  modalities: {
    input: string[];
    output: string[];
  };
  name: string;
  ok: true;
  organization: {
    color: string | null;
    id: string;
    name: string | null;
  } | null;
}
