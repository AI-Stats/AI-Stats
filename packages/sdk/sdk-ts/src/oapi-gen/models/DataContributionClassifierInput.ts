export interface DataContributionClassifierInput {
  categories?: {
    [key: string]: string[];
  };
  description?: string | null;
  enabled?: boolean;
  instructions?: string;
  model?: string;
  name?: string;
  sampleRateBps?: number;
  serviceTier?: "standard" | "flex";
}
