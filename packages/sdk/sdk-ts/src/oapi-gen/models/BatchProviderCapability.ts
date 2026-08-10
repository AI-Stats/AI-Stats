export interface BatchProviderCapability {
  documentation_url?: string;
  endpoints?: {
    endpoint: string;
    mode: "native" | "translated";
  }[];
  gateway_input_modes?: ("file" | "requests")[];
  id?: string;
  name?: string;
  native_input_modes?: ("file" | "requests")[];
  notes?: string | null;
  status?: "active" | "planned";
}
