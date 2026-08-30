export interface DataContributionClassifierResponse {
  data: {
    categories: {
      [key: string]: string[];
    };
    created_at?: string | null;
    description?: string | null;
    enabled: boolean;
    id: string;
    instructions: string;
    kind: "starter" | "custom";
    model: string;
    name: string;
    sample_rate_bps: number;
    service_tier: "standard" | "flex";
    slug: string;
    updated_at?: string | null;
    [key: string]: unknown;
  };
}
