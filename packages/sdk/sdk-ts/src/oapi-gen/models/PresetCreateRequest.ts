export interface PresetCreateRequest {
  config?: {
    [key: string]: unknown;
  };
  description?: string | null;
  name: string;
  slug?: string;
  versioning_method?: "sequential" | "semver" | "date";
  visibility?: "private" | "team" | "public";
}
