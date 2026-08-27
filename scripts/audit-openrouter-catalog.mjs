import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("packages/data/catalog/src/data");
const providerDir = path.join(root, "api_providers/openrouter");
const checkedAt = "2026-08-24T00:00:00Z";
const modelsUrl = "https://openrouter.ai/api/v1/models";
const videosUrl = "https://openrouter.ai/api/v1/videos/models";

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function filesNamed(directory, name, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await filesNamed(file, name, output);
    else if (entry.name === name) output.push(file);
  }
  return output;
}

const orgAliases = {
  "anthracite-org": "anthracite-org", cognitivecomputations: "cognitivecomputations",
  gryphe: "gryphe", liquid: "liquid-ai", mancer: "mancer", "meta-llama": "meta",
  perceptron: "perceptron", rekaai: "reka", thedrummer: "thedrummer",
  thinkingmachines: "thinking-machines", undi95: "undi95", writer: "writer", "x-ai": "xai",
};

const latestAliases = {
  "~z-ai/glm-latest": "z-ai/glm-5.3",
  "~deepseek/deepseek-v4-flash-latest": "deepseek/deepseek-v4-flash-vision-exp",
  "~x-ai/grok-latest": "xai/grok-4.6",
  "~anthropic/claude-fable-latest": "anthropic/claude-fable-5",
  "~anthropic/claude-haiku-latest": "anthropic/claude-haiku-4.5",
  "~anthropic/claude-opus-latest": "anthropic/claude-opus-5",
  "~anthropic/claude-sonnet-latest": "anthropic/claude-sonnet-5",
  "~google/gemini-flash-latest": "google/gemini-3.7-flash",
  "~google/gemini-pro-latest": "google/gemini-3.1-pro-preview",
  "~moonshotai/kimi-latest": "moonshotai/kimi-k3",
  "~openai/gpt-latest": "openai/gpt-5.6-sol",
  "~openai/gpt-mini-latest": "openai/gpt-5.6-luna",
};

const title = (value) => value.split(/[._-]+/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
const modality = (value) => value === "image" ? "image/*" : value === "audio" ? "audio/*" : value === "video" ? "video/*" : value;

const chat = (await json(modelsUrl)).data;
const videosPayload = await json(videosUrl);
const videos = videosPayload.data ?? videosPayload.models ?? [];
const providerModelsPath = path.join(providerDir, "models.json");
const providerModels = JSON.parse(await readFile(providerModelsPath, "utf8"));
const providerSlugs = new Set(providerModels.map((row) => row.provider_model_slug));
const canonicalFiles = await filesNamed(path.join(root, "models"), "model.json");
const canonicalIds = new Set();
for (const file of canonicalFiles) canonicalIds.add(JSON.parse(await readFile(file, "utf8")).model_id);

function canonicalBase(id) {
  if (latestAliases[id]) return latestAliases[id];
  let base = id.replace(/:(batch|free|thinking)$/, "");
  if (base.endsWith("-contributor")) base = base.slice(0, -12);
  if (base.endsWith("-fast") && (canonicalIds.has(base.slice(0, -5)) || chat.some((row) => row.id === base.slice(0, -5)))) base = base.slice(0, -5);
  const [publisher, ...rest] = base.split("/");
  return `${orgAliases[publisher] ?? publisher}/${rest.join("/")}`;
}

async function ensureOrganisation(id) {
  const file = path.join(root, "organisations", id, "organisation.json");
  try { await readFile(file); return; } catch {}
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({
    organisation_id: id, name: title(id), country_code: null,
    description: `${title(id)} publishes models available through OpenRouter.`, colour: null,
    organisation_links: [], status: "active", routable: null,
    sources: [{ kind: "provider_models", url: modelsUrl, accessed_at: checkedAt, notes: "Publisher namespace observed in OpenRouter's official model catalog." }],
    verification: { status: "partial", checked_at: checkedAt, notes: "Publisher identity is based on OpenRouter's official namespace." },
  }, null, 2)}\n`);
}

async function ensureCanonical(id, row) {
  if (canonicalIds.has(id)) return;
  const organisationId = id.split("/")[0];
  await ensureOrganisation(organisationId);
  const input = (row.architecture?.input_modalities ?? ["text"]).map(modality);
  const output = (row.architecture?.output_modalities ?? ["text"]).map(modality);
  const file = path.join(root, "models", ...id.split("/"), "model.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({
    model_id: id, organisation_id: organisationId, name: row.name ?? title(id.split("/").at(-1)),
    status: "Available", previous_model_id: null, description: row.description ?? null,
    announced_date: null, release_date: row.created ? new Date(row.created * 1000).toISOString().slice(0, 10) : null,
    deprecation_date: null, retirement_date: null, license: null, input_types: input, output_types: output,
    api_model_id: id, links: [{ platform: "model", title: "OpenRouter model page", url: `https://openrouter.ai/${row.id}` }],
    details: [], benchmarks: [], family_id: null, page_notice: null,
    model_type: output.includes("video/*") ? "video" : output.includes("image/*") ? "image" : "language",
    knowledge_cutoff: row.knowledge_cutoff ?? null,
    limits: { context: row.context_length ?? row.top_provider?.context_length ?? null, input: null, output: row.top_provider?.max_completion_tokens ?? null },
    modalities: { input, output },
    reasoning: { supported: row.reasoning ? true : null, options: row.reasoning?.supported_efforts ?? [] },
    capabilities: { attachment: input.some((x) => x !== "text"), tool_call: row.supported_parameters?.includes("tools") ?? null, structured_output: row.supported_parameters?.includes("structured_outputs") ?? null, temperature: row.supported_parameters?.includes("temperature") ?? null, streaming: true, web_search: row.supported_parameters?.includes("web_search") ?? null },
    open_weights: row.hugging_face_id ? true : null,
    sources: [{ kind: "provider_models", url: modelsUrl, accessed_at: checkedAt, notes: `Exact live OpenRouter ID: ${row.id}.` }],
    verification: { status: "partial", checked_at: checkedAt, notes: "Availability, modalities, limits and parameters verified against OpenRouter's official models API; upstream publisher metadata remains provider-reported." },
    last_updated: checkedAt.slice(0, 10), removal_date: null, replacement_model_id: null, license_url: null,
  }, null, 2)}\n`);
  canonicalIds.add(id);
}

const ledger = [];
for (const row of chat) {
  if (row.id.startsWith("openrouter/")) {
    ledger.push({ id: row.id, canonical_slug: row.canonical_slug ?? null, surface: "chat", category: "router", canonical_model_id: null, accounted: true, input_modalities: row.architecture?.input_modalities ?? [], output_modalities: row.architecture?.output_modalities ?? [], context_length: row.context_length ?? null, max_output_tokens: row.top_provider?.max_completion_tokens ?? null, supported_parameters: row.supported_parameters ?? [], pricing: row.pricing ?? {}, expiration_date: row.expiration_date ?? null });
    continue;
  }
  const canonicalId = canonicalBase(row.id);
  const category = row.id.startsWith("~") ? "alias" : row.id !== canonicalId && (/:(batch|free|thinking)$/.test(row.id) || row.id.endsWith("-fast") || row.id.endsWith("-contributor")) ? "variant" : "model";
  const canonicalRow = chat.find((candidate) => canonicalBase(candidate.id) === canonicalId && !candidate.id.startsWith("~") && !/:(batch|free|thinking)$/.test(candidate.id)) ?? row;
  await ensureCanonical(canonicalId, canonicalRow);
  if (!providerSlugs.has(row.id)) {
    const params = row.supported_parameters ?? [];
    providerModels.push({
      api_model_id: canonicalId, provider_api_model_id: `openrouter:${row.id}`, provider_model_slug: row.id,
      internal_model_id: canonicalId, is_active_gateway: false, quantization_scheme: null,
      input_modalities: row.architecture?.input_modalities?.join(",") ?? null,
      output_modalities: row.architecture?.output_modalities?.join(",") ?? null,
      context_length: row.context_length ?? row.top_provider?.context_length ?? null,
      max_output_tokens: row.top_provider?.max_completion_tokens ?? null, effective_from: null,
      effective_to: row.expiration_date ?? null,
      capabilities: [{ capability_id: "text.generate", status: "active", params, reasoning: Boolean(row.reasoning), tool_call: params.includes("tools"), structured_output: params.includes("structured_outputs"), temperature: params.includes("temperature"), attachment: (row.architecture?.input_modalities?.length ?? 1) > 1, input_modalities: row.architecture?.input_modalities ?? null, output_modalities: row.architecture?.output_modalities ?? null, modes: [] }],
      routing_status: "active", routable: false, regions: { execution: ["global"], data: ["global"] }, service_tiers: category === "variant" && row.id.endsWith(":batch") ? ["batch"] : [],
      api: { formats: ["openai.chat_completions"], endpoint: "/chat/completions", deployment: null },
      sources: [{ kind: "provider_models", url: modelsUrl, accessed_at: checkedAt, notes: `Exact live OpenRouter ID; classified as ${category}.` }],
      verification: { status: "verified", checked_at: checkedAt, notes: "Verified against OpenRouter's official live models API; Phaseo routing remains disabled." }, rate_limits: [],
    });
    providerSlugs.add(row.id);
  }
  ledger.push({ id: row.id, canonical_slug: row.canonical_slug ?? null, surface: "chat", category, canonical_model_id: canonicalId, accounted: true, input_modalities: row.architecture?.input_modalities ?? [], output_modalities: row.architecture?.output_modalities ?? [], context_length: row.context_length ?? null, max_output_tokens: row.top_provider?.max_completion_tokens ?? null, supported_parameters: row.supported_parameters ?? [], pricing: row.pricing ?? {}, expiration_date: row.expiration_date ?? null });
}

for (const row of videos) {
  const id = row.id ?? row.model_id;
  const canonicalId = canonicalBase(id);
  await ensureCanonical(canonicalId, { ...row, id, architecture: { input_modalities: ["text", ...(row.supported_frame_images?.length ? ["image"] : [])], output_modalities: ["video"] }, context_length: null, top_provider: null, supported_parameters: row.allowed_passthrough_parameters ?? [] });
  if (!providerSlugs.has(id)) {
    providerModels.push({
      api_model_id: canonicalId, provider_api_model_id: `openrouter:${id}`, provider_model_slug: id, internal_model_id: canonicalId,
      is_active_gateway: false, quantization_scheme: null, input_modalities: row.supported_frame_images?.length ? "text,image" : "text", output_modalities: "video",
      context_length: null, max_output_tokens: null, effective_from: null, effective_to: null,
      capabilities: [{ capability_id: "video.generate", status: "active", params: row.allowed_passthrough_parameters ?? [], reasoning: false, tool_call: false, structured_output: false, temperature: false, attachment: Boolean(row.supported_frame_images?.length), input_modalities: row.supported_frame_images?.length ? ["text", "image"] : ["text"], output_modalities: ["video"], modes: [] }],
      routing_status: "active", routable: false, regions: { execution: ["global"], data: ["global"] }, service_tiers: [],
      api: { formats: [], endpoint: "/videos", deployment: null },
      sources: [{ kind: "provider_models", url: videosUrl, accessed_at: checkedAt, notes: "Exact live OpenRouter asynchronous video model ID and capabilities." }],
      verification: { status: "verified", checked_at: checkedAt, notes: "Verified against OpenRouter's official live video models API; Phaseo routing remains disabled." }, rate_limits: [],
    });
    providerSlugs.add(id);
  }
  ledger.push({ id, canonical_slug: row.canonical_slug ?? null, surface: "video", category: "video-model", canonical_model_id: canonicalId, accounted: true, supported_resolutions: row.supported_resolutions ?? [], supported_aspect_ratios: row.supported_aspect_ratios ?? [], supported_sizes: row.supported_sizes ?? null, supported_durations: row.supported_durations ?? [], supported_frame_images: row.supported_frame_images ?? [], allowed_passthrough_parameters: row.allowed_passthrough_parameters ?? [], generate_audio: row.generate_audio ?? null, seed: row.seed ?? null, pricing_skus: row.pricing_skus ?? {}, note: "Exact published SKU pricing is retained; no normalized pricing row is emitted where SKU semantics do not map losslessly to the catalog schema." });
}

providerModels.sort((a, b) => a.provider_model_slug.localeCompare(b.provider_model_slug));
await writeFile(providerModelsPath, `${JSON.stringify(providerModels, null, 2)}\n`);
await writeFile(path.join(providerDir, "reconciliation-2026-08-24.json"), `${JSON.stringify({
  provider: "openrouter", checked_at: checkedAt, sources: [modelsUrl, videosUrl],
  totals: { chat: chat.length, video: videos.length, accounted: ledger.length, unaccounted: 0,
    models: ledger.filter((x) => x.category === "model").length,
    variants: ledger.filter((x) => x.category === "variant").length,
    aliases: ledger.filter((x) => x.category === "alias").length,
    routers: ledger.filter((x) => x.category === "router").length,
    video_models: videos.length }, items: ledger,
}, null, 2)}\n`);
console.log(JSON.stringify({ chat: chat.length, video: videos.length, providerMappings: providerModels.length, unaccounted: 0 }));
