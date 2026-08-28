import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataRoot = path.join(root, "packages/data/catalog/src/data");
const providerModelsPath = path.join(dataRoot, "api_providers/nano-gpt/models.json");
const outputPath = path.join(dataRoot, "api_providers/nano-gpt/reconciliation-2026-08-24.json");
const feeds = [
	["text", "https://nano-gpt.com/api/v1/models?detailed=true"],
	["image", "https://nano-gpt.com/api/v1/image-models"],
	["video", "https://nano-gpt.com/api/v1/video-models"],
	["audio", "https://nano-gpt.com/api/v1/audio-models"],
	["embedding", "https://nano-gpt.com/api/v1/embedding-models"],
];

const routes = JSON.parse(await readFile(providerModelsPath, "utf8"));
const routeBySlug = new Map(routes.map((route) => [route.provider_model_slug, route]));
const routerIds = /^(auto-model(?:-.+)?|nano-gpt-help|nanogpt\/coding-router(?::.+)?|brave(?:-.+)?|claw-(?:low|medium|high)|hermes-(?:low|medium|high))$/i;
const variantIds = /:(?:thinking|low|medium|high|max|\d+)$/i;

function pricingShape(pricing) {
	if (!pricing || typeof pricing !== "object") return "not_published";
	const values = Object.values(pricing).filter((value) => typeof value === "number");
	const nested = Object.values(pricing).some((value) => value && typeof value === "object");
	return nested ? "conditional_or_variant" : values.length ? "fixed" : "metadata_only";
}

const entries = [];
for (const [modality, url] of feeds) {
	const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	const body = await response.json();
	for (const model of body.data ?? []) {
		const route = routeBySlug.get(model.id);
		let disposition;
		let reason;
		if (route) {
			disposition = "included_catalog_route";
			reason = `Exact NanoGPT ID mapped to canonical ${route.api_model_id}; route remains non-routable.`;
		} else if (routerIds.test(model.id)) {
			disposition = "excluded_router_or_platform_utility";
			reason = "Dynamic router, search product, help model, or platform utility; not a stable canonical model identity.";
		} else if (variantIds.test(model.id)) {
			disposition = "excluded_parameterized_variant";
			reason = "Reasoning/provider effort suffix is a selectable variant of the base route, not a distinct canonical model.";
		} else {
			disposition = "excluded_insufficient_authoritative_identity";
			reason = "NanoGPT documents the endpoint and price, but its aggregator metadata alone does not establish a canonical upstream release identity, lifecycle, or first-party organisation source safely enough to create a global model entity.";
		}
		const shape = pricingShape(model.pricing);
		entries.push({
			id: model.id,
			feed: modality,
			owned_by: model.owned_by ?? null,
			name: model.name ?? null,
			disposition,
			reason,
			canonical_model_id: route?.api_model_id ?? null,
			pricing_disposition: route
				? (shape === "conditional_or_variant" ? "schema_blocked_conditional_or_variant" : shape === "fixed" ? "published_fixed_price_structured" : "published_price_reconciled_or_preserved")
				: "not_applicable_without_canonical_route",
			pricing_shape: shape,
			pricing: model.pricing ?? null,
			source_url: url,
		});
	}
}

entries.sort((left, right) => left.feed.localeCompare(right.feed) || left.id.localeCompare(right.id));
const counts = Object.fromEntries([...new Set(entries.map((entry) => entry.disposition))].sort().map((key) => [key, entries.filter((entry) => entry.disposition === key).length]));
const ledger = {
	provider: "nano-gpt",
	accessed_at: "2026-08-24T00:00:00.000Z",
	total_live_ids: entries.length,
	unique_live_ids: new Set(entries.map((entry) => entry.id)).size,
	unaccounted: 0,
	counts,
	notes: [
		"This ledger is reproducible by running node scripts/catalogue/reconcile-nanogpt-ledger.mjs.",
		"Published pricing objects are retained verbatim for auditability, including structures the current pricing schema cannot encode without losing conditions.",
		"An exclusion here does not assert that the endpoint is unavailable; it prevents NanoGPT-only aggregator metadata from creating an unverified global canonical identity.",
	],
	entries,
};
await writeFile(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ total: ledger.total_live_ids, unique: ledger.unique_live_ids, unaccounted: ledger.unaccounted, counts }));
