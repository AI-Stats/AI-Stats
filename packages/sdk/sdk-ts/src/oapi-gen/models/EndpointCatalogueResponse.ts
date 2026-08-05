export interface EndpointCatalogueResponse {
  data: {
    capability_id: string;
    collection: string;
    id: string;
    model_count: number;
    provider_count: number;
    public_path: string;
  }[];
  endpoints: string[];
  ok: true;
  sample_models: string[];
}
