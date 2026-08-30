export interface PresetCreateResponse {
  canonical_model: string;
  data: {
    active_version_id?: string | null;
    config: {
      [key: string]: unknown;
    };
    created_at?: string | null;
    created_by?: string | null;
    description?: string | null;
    id: string;
    name: string;
    slug: string;
    source_preset_id?: string | null;
    source_preset_version_id?: string | null;
    updated_at?: string | null;
    upstream_version_id?: string | null;
    versioning_method: "sequential" | "semver" | "date";
    visibility: "private" | "team" | "public";
    workspace_id: string;
  };
}
