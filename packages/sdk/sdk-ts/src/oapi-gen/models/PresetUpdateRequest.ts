export interface PresetUpdateRequest {
  config?: {
    [key: string]: unknown;
  };
  description?: string | null;
  name?: string;
  replace_config?: boolean;
  slug?: string;
  versioning_method?: "sequential" | "semver" | "date";
  visibility?: "private" | "team" | "public";
}
