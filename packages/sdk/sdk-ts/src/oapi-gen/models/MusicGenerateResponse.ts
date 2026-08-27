export interface MusicGenerateResponse {
  audio_base64?: string;
  audio_url?: string;
  id: string;
  model: string;
  nativeResponseId?: string | null;
  object: "music";
  output?: {
    [key: string]: unknown;
  }[];
  provider: string;
  result?: unknown;
  status: "queued" | "in_progress" | "completed" | "failed";
  usage?: {
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
