import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataRoot = path.join(root, "packages/data/catalog/src/data");
const modelsPath = path.join(dataRoot, "api_providers/poe/models.json");
const checkedAt = "2026-08-24T03:27:45Z";
const sourceUrl = "https://api.poe.com/v1/models";

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Poe models API returned ${response.status}`);
const payload = await response.json();
if (!Array.isArray(payload.data)) throw new Error("Poe models API returned no data array");

const current = JSON.parse(fs.readFileSync(modelsPath, "utf8"));
const bySlug = new Map(current.map((entry) => [entry.provider_model_slug, entry]));
const liveSlugs = new Set(payload.data.map((entry) => entry.id));

const formatMap = {
  "/v1/chat/completions": "openai.chat.completions",
  "/v1/responses": "openai.responses",
  "/v1/messages": "anthropic_messages",
  "/v1/videos": "openai.video",
};

function capabilitiesFor(model) {
  const outputs = model.architecture?.output_modalities ?? ["text"];
  return [
    ...(outputs.includes("text") ? ["text.generate"] : []),
    ...(outputs.includes("image") ? ["image.generate"] : []),
    ...(outputs.includes("video") ? ["video.generate"] : []),
    ...(outputs.includes("audio") ? ["audio.speech"] : []),
  ];
}

function canonicalId(model) {
  return bySlug.get(model.id)?.internal_model_id ?? `poe/${model.id.toLowerCase()}`;
}

function source(notes) {
  return [{ kind: "provider_models", url: sourceUrl, accessed_at: checkedAt, notes }];
}

function capability(model, capabilityId, status = "active") {
  const inputs = model.architecture?.input_modalities ?? null;
  const outputs = model.architecture?.output_modalities ?? null;
  const features = new Set(model.supported_features ?? []);
  const params = (model.parameters ?? []).map((parameter) => parameter.name).filter(Boolean);
  return {
    capability_id: capabilityId, status, params,
    reasoning: model.reasoning != null || params.some((name) => name.includes("reasoning") || name.includes("thinking")),
    tool_call: features.has("tools"), structured_output: (model.supported_endpoints ?? []).includes("/v1/responses") || null,
    temperature: params.includes("temperature") || null,
    attachment: inputs?.some((value) => value !== "text") ?? null,
    input_modalities: inputs, output_modalities: outputs, modes: [],
  };
}

function route(model) {
  const old = bySlug.get(model.id);
  const id = canonicalId(model);
  const endpoints = model.supported_endpoints ?? [];
  const formats = endpoints.map((endpoint) => formatMap[endpoint]).filter(Boolean);
  return {
    api_model_id: id,
    provider_api_model_id: `poe:${model.id}`,
    provider_model_slug: model.id,
    internal_model_id: id,
    is_active_gateway: false,
    quantization_scheme: old?.quantization_scheme ?? null,
    input_modalities: (model.architecture?.input_modalities ?? []).join(",") || null,
    output_modalities: (model.architecture?.output_modalities ?? []).join(",") || null,
    context_length: model.context_window?.context_length ?? model.context_length ?? null,
    max_output_tokens: model.context_window?.max_output_tokens ?? null,
    effective_from: old?.effective_from ?? new Date(model.created).toISOString(),
    effective_to: null,
    capabilities: capabilitiesFor(model).map((capabilityId) => capability(model, capabilityId)),
    routing_status: "active",
    routable: false,
    regions: { execution: [], data: [] },
    service_tiers: [],
    api: {
      formats,
      endpoint: endpoints.length ? "https://api.poe.com/v1" : null,
      deployment: endpoints.length ? "hosted" : null,
    },
    sources: source("Authoritative public Poe bot/model inventory, modalities, limits, features, endpoints and pricing."),
    verification: {
      status: "verified", checked_at: checkedAt,
      notes: "Exact public bot slug and advertised metadata verified against Poe's unauthenticated models API; Phaseo routing remains disabled.",
    },
    rate_limits: [],
  };
}

function retiredRoute(entry) {
  const historySource = source("Absent from the complete public Poe models API response; retained as disabled history.")[0];
  return {
    ...entry,
    effective_to: entry.effective_to ?? checkedAt,
    capabilities: entry.capabilities.map((item) => ({ ...item, status: "inactive" })),
    routing_status: "disabled",
    sources: [
      ...entry.sources.filter((item) => !(item.url === sourceUrl && item.notes === historySource.notes)),
      historySource,
    ],
    verification: {
      status: "verified", checked_at: checkedAt,
      notes: "No longer returned by Poe's complete public models API; route and historical pricing retained but disabled.",
    },
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCanonicalModel(model, id) {
  if (!id.startsWith("poe/")) return;
  const file = path.join(dataRoot, "models", ...id.split("/"), "model.json");
  if (fs.existsSync(file)) return;
  const inputs = model.architecture?.input_modalities ?? [];
  const outputs = model.architecture?.output_modalities ?? [];
  const released = new Date(model.created).toISOString().slice(0, 19);
  writeJson(file, {
    model_id: id, organisation_id: "poe", name: model.metadata?.display_name ?? model.id,
    status: "Available", previous_model_id: null, description: model.description ?? `Public Poe bot ${model.id}.`,
    announced_date: released, release_date: released, deprecation_date: null, retirement_date: null,
    license: "Proprietary", input_types: inputs.join(",") || null, output_types: outputs.join(",") || null,
    api_model_id: id, family_id: null,
    links: model.metadata?.url ? [{ title: "Poe bot", kind: "api_reference", url: model.metadata.url }] : [],
    details: [
      ...(model.context_window?.context_length ? [{ name: "input_context_length", value: model.context_window.context_length }] : []),
      ...(model.context_window?.max_output_tokens ? [{ name: "output_context_length", value: model.context_window.max_output_tokens }] : []),
    ],
    benchmarks: [], page_notice: null, model_type: "Poe bot", knowledge_cutoff: null,
    limits: { context: model.context_window?.context_length ?? null, input: model.context_window?.context_length ?? null, output: model.context_window?.max_output_tokens ?? null },
    modalities: { input: inputs, output: outputs },
    reasoning: { supported: model.reasoning != null, options: model.reasoning?.supports_reasoning_effort ? ["low", "medium", "high"] : [] },
    capabilities: {
      attachment: inputs.some((value) => value !== "text"), tool_call: (model.supported_features ?? []).includes("tools"),
      structured_output: (model.supported_endpoints ?? []).includes("/v1/responses"), temperature: null,
      streaming: true, web_search: (model.supported_features ?? []).includes("web_search"),
    },
    open_weights: null,
    sources: source("Canonical entity for an exact public Poe bot identifier returned by the models API."),
    verification: { status: "verified", checked_at: checkedAt, notes: "Identity and advertised metadata verified against Poe's public models API." },
    last_updated: checkedAt, removal_date: null, replacement_model_id: null, license_url: null,
  });
}

function writePricing(model, id) {
  if (!model.pricing) return;
  const p = model.pricing;
  const specs = [
    ["prompt", "input_text_tokens", "token", 1_000_000],
    ["completion", "output_text_tokens", "token", 1_000_000],
    ["input_cache_read", "cached_read_text_tokens", "token", 1_000_000],
    ["input_cache_write", "cached_write_text_tokens", "token", 1_000_000],
    ["image", "input_image_tokens", "token", 1_000_000],
    ["request", "requests", "request", 1],
  ];
  const rules = specs.flatMap(([field, meter, unit, size]) => p[field] == null ? [] : [{
    meter, unit, unit_size: size, price_per_unit: Number(p[field]) * size, currency: "USD",
    pricing_plan: "standard", note: field === "request" ? "Per-request rate advertised by Poe." : null,
    match: [], priority: 100, region: null, cache_duration_seconds: null, conditions: [], source: sourceUrl,
  }]);
  if (!rules.length) return;
  const folder = id.replaceAll("/", "-");
  for (const capabilityId of capabilitiesFor(model)) {
    writeJson(path.join(dataRoot, "pricing/poe", folder, capabilityId, "pricing.json"), {
      key: `poe:${id}:${capabilityId}`, api_provider_id: "poe", provider_slug: "poe",
      api_model_id: id, capability_id: capabilityId, rules, regions: [], service_tiers: ["standard"],
      sources: source("Exact per-token and/or per-request USD-equivalent point cost advertised by Poe."),
      verification: { status: "verified", checked_at: checkedAt, notes: "All non-null Poe pricing fields are represented; USD rates consume the API key owner's Poe points." },
    });
  }
}

for (const model of payload.data) {
  const id = canonicalId(model);
  writeCanonicalModel(model, id);
  writePricing(model, id);
}

const routes = [
  ...payload.data.map(route),
  ...current.filter((entry) => !liveSlugs.has(entry.provider_model_slug)).map(retiredRoute),
].sort((a, b) => a.provider_model_slug.localeCompare(b.provider_model_slug));
writeJson(modelsPath, routes);

console.log(JSON.stringify({ live: payload.data.length, active: payload.data.length, retired: routes.length - payload.data.length, total: routes.length }, null, 2));
