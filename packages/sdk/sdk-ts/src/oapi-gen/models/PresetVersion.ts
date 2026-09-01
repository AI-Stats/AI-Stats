export interface PresetVersion {
  config: {
    [key: string]: unknown;
  };
  created_at: string;
  created_by: string;
  description?: string | null;
  id: string;
  name: string;
  preset_id: string;
  release_notes?: string | null;
  slug: string;
  version_label: string;
  version_number: number;
  versioning_method: "sequential" | "semver" | "date";
  visibility: "private" | "team" | "public";
}
