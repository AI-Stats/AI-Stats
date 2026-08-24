import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataRoot = path.join(root, "packages/data/catalog/src/data");
const modelsPath = path.join(dataRoot, "api_providers/nano-gpt/models.json");
const ledgerPath = path.join(dataRoot, "api_providers/nano-gpt/reconciliation-2026-08-24.json");
const models = JSON.parse(await readFile(modelsPath, "utf8"));
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const bySlug = new Map(models.map((model) => [model.provider_model_slug, model]));
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
const source = (url) => [{ kind: "provider_models", url, accessed_at: "2026-08-24T00:00:00.000Z", notes: "NanoGPT public model feed pricing." }];
const rule = (meter, unit, unitSize, price, url) => ({
	meter, unit, unit_size: unitSize, price_per_unit: price, currency: "USD", pricing_plan: "standard",
	note: null, match: [], priority: 100, region: null, cache_duration_seconds: null, conditions: [], source: url,
});

let created = 0;
let capabilityUpdates = 0;
for (const entry of ledger.entries) {
	if (entry.disposition !== "included_catalog_route" || entry.pricing_shape !== "fixed") continue;
	const model = bySlug.get(entry.id);
	if (!model) continue;
	const pricing = entry.pricing;
	let capability = model.capabilities[0].capability_id;
	const rules = [];
	if (entry.feed === "text" && Number.isFinite(pricing.prompt) && Number.isFinite(pricing.completion)) {
		capability = "text.generate";
		rules.push(rule("input_text_tokens", "token", 1_000_000, pricing.prompt, entry.source_url));
		rules.push(rule("output_text_tokens", "token", 1_000_000, pricing.completion, entry.source_url));
		if (Number.isFinite(pricing.cacheReadInputPer1kTokens)) rules.push(rule("cached_read_text_tokens", "token", 1_000, pricing.cacheReadInputPer1kTokens, entry.source_url));
	} else if (entry.feed === "embedding" && Number.isFinite(pricing.per_million_tokens)) {
		capability = "text.embed";
		rules.push(rule("input_text_tokens", "token", 1_000_000, pricing.per_million_tokens, entry.source_url));
	} else if (entry.feed === "audio" && Number.isFinite(pricing.per_thousand_chars)) {
		capability = "audio.speech";
		rules.push(rule("input_characters", "character", 1_000, pricing.per_thousand_chars, entry.source_url));
	} else if (entry.feed === "audio" && Number.isFinite(pricing.per_minute)) {
		capability = "audio.transcription";
		rules.push(rule("input_audio_seconds", "second", 60, pricing.per_minute, entry.source_url));
	}
	if (!rules.length) continue;
	if (model.capabilities[0].capability_id !== capability) {
		model.capabilities[0].capability_id = capability;
		capabilityUpdates += 1;
	}
	const target = path.join(dataRoot, "pricing/nano-gpt", slug(model.api_model_id), capability, "pricing.json");
	try { await readFile(target); continue; } catch {}
	const record = {
		key: `nano-gpt:${model.api_model_id}:${capability}`,
		api_provider_id: "nano-gpt", provider_slug: "nano-gpt", api_model_id: model.api_model_id,
		capability_id: capability, rules, regions: [], service_tiers: ["standard"], sources: source(entry.source_url),
		verification: { status: "verified", checked_at: "2026-08-24T00:00:00.000Z", notes: "Exact fixed price from NanoGPT's public model feed." },
	};
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, `${JSON.stringify(record, null, 2)}\n`, "utf8");
	created += 1;
}
await writeFile(modelsPath, `${JSON.stringify(models, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ pricingCreated: created, capabilityUpdates }));
