export interface DataContributionOverviewResponse {
  data: {
    analytics: {
      [key: string]: unknown;
    }[];
    classifiers: {
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
    }[];
    classifierSampleRateBps: number;
    consentedAt?: string | null;
    discountBps: number;
    enabled: boolean;
    last30Days: {
      contributions: number;
      discountNanos: number;
    };
    policyVersion: string;
    sampleRateBps: number;
    starterCategories: {
      [key: string]: string[];
    };
  };
}
