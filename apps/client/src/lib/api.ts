import Constants from "expo-constants";
import { z } from "zod";

const extra = Constants.expoConfig?.extra as { phaseoOrigin?: string; phaseoApiOrigin?: string } | undefined;
export const WEB_ORIGIN = extra?.phaseoOrigin ?? "https://phaseo.app";
export const API_ORIGIN = extra?.phaseoApiOrigin ?? "https://api.phaseo.app/v1";

const rawModelSchema = z.object({
  id: z.string().optional(),
  model_id: z.string().optional(),
  name: z.string().optional(),
  organisation: z.object({ name: z.string().optional() }).optional(),
  organisation_name: z.string().optional(),
  description: z.string().nullish(),
  release_date: z.string().nullish(),
  context_length: z.number().nullish(),
  input_modalities: z.array(z.string()).optional(),
  output_modalities: z.array(z.string()).optional(),
  input_types: z.string().optional(),
  output_types: z.string().optional(),
  providers: z.array(z.unknown()).optional(),
  lowest_input_price: z.number().nullish(),
  lowest_output_price: z.number().nullish(),
  status: z.string().nullish()
}).passthrough().refine(model => Boolean(model.id ?? model.model_id), { message: "Model identifier is missing" }).transform(model => ({
  ...model,
  id: model.id ?? model.model_id!,
  input_modalities: model.input_modalities ?? model.input_types?.split(",").filter(Boolean),
  output_modalities: model.output_modalities ?? model.output_types?.split(",").filter(Boolean)
}));

const modelSchema = rawModelSchema;

export type PhaseoModel = z.infer<typeof modelSchema>;
const modelsEnvelope = z.union([
  z.array(modelSchema),
  z.object({ models: z.array(modelSchema), next_cursor: z.string().nullish().optional() }),
  z.object({ data: z.array(modelSchema), next_cursor: z.string().nullish().optional() })
]);

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request(path: string, init?: RequestInit, token?: string): Promise<unknown> {
  const response = await fetch(`${WEB_ORIGIN}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) throw new ApiError(response.status, response.status === 401 ? "Your session has expired." : "Phaseo could not load this data.");
  return response.json();
}

export async function getModels(query = ""): Promise<PhaseoModel[]> {
  const raw = await request(`/api/_web/models?shape=page&projection=5&limit=40${query ? `&search=${encodeURIComponent(query)}` : ""}`);
  const parsed = modelsEnvelope.parse(raw);
  return Array.isArray(parsed) ? parsed : "models" in parsed ? parsed.models : parsed.data;
}

export async function getModel(id: string): Promise<PhaseoModel> {
  const raw = await request(`/api/_web/models/${encodeURIComponent(id)}`);
  return modelSchema.parse((raw as { model?: unknown }).model ?? raw);
}

export async function getReleases(): Promise<unknown> {
  return request("/api/_web/updates/models?limit=12&upcoming_limit=8");
}

export async function getAccount(path: string, token: string): Promise<unknown> {
  return request(`/api/account${path}`, undefined, token);
}

export async function streamChat(args: { apiKey: string; model: string; messages: { role: string; content: string }[]; signal?: AbortSignal; onDelta(delta: string): void }) {
  const response = await fetch(`${API_ORIGIN}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${args.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: args.model, messages: args.messages, stream: true }),
    signal: args.signal
  });
  if (!response.ok || !response.body) throw new ApiError(response.status, response.status === 401 ? "This API key is invalid." : "The chat request failed.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) args.onDelta(delta);
      }
    }
  }
}
