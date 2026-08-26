import fs from 'node:fs';
import path from 'node:path';
import { normalizeCatalogModality } from './normalize-catalog-modality.mjs';

const root = process.cwd();
const accessedAt = '2026-08-24T00:00:00Z';
const sourceUrl = 'https://zenmux.ai/api/v1/models';
const providerDir = path.join(root, 'packages/data/catalog/src/data/api_providers/zenmux');
const pricingRoot = path.join(root, 'packages/data/catalog/src/data/pricing/zenmux');
const modelsRoot = path.join(root, 'packages/data/catalog/src/data/models');
const orgRoot = path.join(root, 'packages/data/catalog/src/data/organisations');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); };

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`ZenMux models API returned ${response.status}`);
const live = (await response.json()).data;
if (!Array.isArray(live) || live.length !== 165) throw new Error(`Expected audited snapshot of 165 models, received ${live?.length}`);

const old = json(path.join(providerDir, 'models.json'));
const oldBySlug = new Map(old.map((m) => [m.provider_model_slug, m]));
const aliasOrg = { 'x-ai': 'spacex-ai', kuaishou: 'kwaipilot', mistralai: 'mistral' };
const canonicalId = (id) => {
  const [org, ...rest] = id.split('/');
  return `${aliasOrg[org] ?? org}/${rest.join('/')}`;
};
const modality = (x) => x === 'image' ? 'image/*' : x === 'audio' ? 'audio/*' : x === 'video' ? 'video/*' : x === 'file' ? 'application/*' : x;
const canonicalModalities = (values) => values.map(normalizeCatalogModality);
const capabilityFor = (m) => {
  const outputModalities = canonicalModalities(m.output_modalities);
  return outputModalities.includes('embeddings') ? 'text.embed'
    : outputModalities.includes('image') ? 'image.generate'
    : outputModalities.includes('audio_stt') ? 'audio.transcription'
    : 'text.generate';
};
const source = { kind: 'provider_models', url: sourceUrl, accessed_at: accessedAt, notes: 'Official live ZenMux model, modality, context, capability, publication, and pricing metadata.' };

const entries = live.map((m) => {
  const internal = canonicalId(m.id);
  const cap = capabilityFor(m);
  const previous = oldBySlug.get(m.id);
  return {
    api_model_id: internal,
    provider_api_model_id: `zenmux:${m.id}`,
    provider_model_slug: m.id,
    internal_model_id: internal,
    is_active_gateway: false,
    quantization_scheme: previous?.quantization_scheme ?? null,
    input_modalities: canonicalModalities(m.input_modalities).join(','),
    output_modalities: canonicalModalities(m.output_modalities).join(','),
    context_length: m.context_length ?? null,
    max_output_tokens: previous?.max_output_tokens ?? null,
    effective_from: m.publish_time ? `${m.publish_time}T00:00:00Z` : null,
    effective_to: null,
    capabilities: [{
      capability_id: cap, status: 'active', params: [],
      reasoning: m.capabilities?.reasoning ?? null,
      tool_call: previous?.capabilities?.[0]?.tool_call ?? null,
      structured_output: previous?.capabilities?.[0]?.structured_output ?? null,
      temperature: previous?.capabilities?.[0]?.temperature ?? null,
      attachment: m.input_modalities.some((x) => x !== 'text'),
      input_modalities: null, output_modalities: null, modes: [],
    }],
    routing_status: 'disabled', routable: false,
    regions: { execution: ['global'], data: ['SG'] },
    service_tiers: ['standard'],
    api: { formats: ['openai.chat.completions'], endpoint: null, deployment: null },
    sources: [source],
    verification: { status: 'verified', checked_at: accessedAt, notes: 'Confirmed present in the unauthenticated official ZenMux models API; Phaseo gateway routing remains disabled.' },
    rate_limits: [],
  };
});

for (const previous of old) {
  if (live.some((m) => m.id === previous.provider_model_slug)) continue;
  entries.push({ ...previous, is_active_gateway: false, effective_to: accessedAt, capabilities: previous.capabilities.map((c) => ({ ...c, status: 'disabled' })), routing_status: 'disabled', routable: false, verification: { status: 'verified', checked_at: accessedAt, notes: 'Absent from the official ZenMux live models API on 2026-08-24; retained as disabled historical catalogue data.' } });
}
entries.sort((a, b) => a.provider_model_slug.localeCompare(b.provider_model_slug));
write(path.join(providerDir, 'models.json'), entries);

const orgNames = { 'sapiens-ai': 'Sapiens AI' };
for (const m of live) {
  const internal = canonicalId(m.id);
  const [org, slug] = internal.split('/');
  const orgFile = path.join(orgRoot, org, 'organisation.json');
  if (!fs.existsSync(orgFile)) write(orgFile, {
    organisation_id: org, name: orgNames[org] ?? org.replaceAll('-', ' ').replace(/\b\w/g, (x) => x.toUpperCase()), country_code: null,
    description: null, colour: null, organisation_links: [], status: 'active', routable: null,
    sources: [source], verification: { status: 'partial', checked_at: accessedAt, notes: 'Organisation ownership follows the official ZenMux model namespace.' },
  });
  const modelFile = path.join(modelsRoot, org, slug, 'model.json');
  if (!fs.existsSync(modelFile)) write(modelFile, {
    model_id: internal, organisation_id: org, name: m.display_name.replace(/^[^:]+:\s*/, ''), status: 'Available', previous_model_id: null,
    description: `${m.display_name.replace(/^[^:]+:\s*/, '')} is available through ZenMux's unified model API.`, announced_date: null, release_date: m.publish_time ? `${m.publish_time}T00:00:00` : null, deprecation_date: null, retirement_date: null,
    license: null, input_types: canonicalModalities(m.input_modalities).join(','), output_types: canonicalModalities(m.output_modalities).join(','), api_model_id: internal,
    links: [], details: [], benchmarks: [], family_id: null, page_notice: null, model_type: null, knowledge_cutoff: null,
    limits: { context: m.context_length ?? null, input: m.context_length ?? null, output: null },
    modalities: { input: canonicalModalities(m.input_modalities).map(modality), output: canonicalModalities(m.output_modalities).map(modality) },
    reasoning: { supported: m.capabilities?.reasoning ?? null, options: [] },
    capabilities: { attachment: m.input_modalities.some((x) => x !== 'text'), tool_call: null, structured_output: null, temperature: null, streaming: null, web_search: Boolean(m.pricings?.web_search) },
    open_weights: null, sources: [source], verification: { status: 'partial', checked_at: accessedAt, notes: 'Availability, namespace, modalities, context, and publication date verified against the official ZenMux models API; upstream model metadata was not independently re-audited.' },
    last_updated: accessedAt, removal_date: null, replacement_model_id: null, license_url: null,
  });
}

const meters = {
  prompt: ['input_text_tokens', 'token', 1_000_000], completion: ['output_text_tokens', 'token', 1_000_000],
  input_cache_read: ['cached_read_text_tokens', 'token', 1_000_000], input_cache_write: ['cached_write_text_tokens', 'token', 1_000_000],
  input_cache_write_1_h: ['cached_write_text_tokens', 'token', 1_000_000], input_cache_write_5_min: ['cached_write_text_tokens', 'token', 1_000_000],
  web_search: ['native_web_search_requests', 'request', 1], audio_input: ['input_audio_tokens', 'token', 1_000_000],
  audio_cache_read: ['cached_read_audio_tokens', 'token', 1_000_000],
};
for (const m of live) {
  const internal = canonicalId(m.id);
  const cap = capabilityFor(m);
  const rules = [];
  for (const [item, prices] of Object.entries(m.pricings ?? {})) {
    const meter = meters[item];
    if (!meter) throw new Error(`Unmapped ZenMux billing item: ${item}`);
    const unique = [...new Map(prices.map((p) => [`${p.value}|${p.unit}|${p.currency}`, p])).values()];
    unique.forEach((p, index) => rules.push({
      meter: meter[0], unit: meter[1], unit_size: meter[2], price_per_unit: p.value, currency: p.currency,
      pricing_plan: unique.length === 1 ? 'standard' : `upstream-${index + 1}`,
      note: item === 'input_cache_write_1_h' ? '1-hour cache write' : item === 'input_cache_write_5_min' ? '5-minute cache write' : null,
      match: [], priority: 100 - index, region: null,
      cache_duration_seconds: item === 'input_cache_write_1_h' ? 3600 : item === 'input_cache_write_5_min' ? 300 : null,
      conditions: [], source: null,
    }));
  }
  const safe = internal.replaceAll('/', '-');
  write(path.join(pricingRoot, safe, cap, 'pricing.json'), {
    key: `zenmux:${internal}:${cap}`, api_provider_id: 'zenmux', provider_slug: 'zenmux', api_model_id: internal, capability_id: cap,
    rules, regions: [], service_tiers: [...new Set(rules.map((r) => r.pricing_plan))], sources: [source],
    verification: { status: 'verified', checked_at: accessedAt, notes: 'Every distinct public price point from the official ZenMux models API is represented; upstream-specific labels are not exposed by that endpoint.' },
  });
}

const ledger = {
  provider: 'zenmux', checked_at: accessedAt, source: sourceUrl,
  live_total: live.length, prior_total: old.length, overlap: live.filter((m) => oldBySlug.has(m.id)).length,
  added: live.filter((m) => !oldBySlug.has(m.id)).map((m) => m.id).sort(),
  disabled_history: old.filter((m) => !live.some((x) => x.id === m.provider_model_slug)).map((m) => m.provider_model_slug).sort(),
  accounted_live: live.length, unaccounted_live: 0,
};
write(path.join(providerDir, 'audit-2026-08-24.json'), ledger);
