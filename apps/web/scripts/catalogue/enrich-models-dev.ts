import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type JsonObject = Record<string, any>;

type SourceModel = {
	id?: string;
	reasoning?: boolean;
	tool_call?: boolean;
	structured_output?: boolean;
	attachment?: boolean;
	modalities?: { input?: string[]; output?: string[] };
	limit?: { context?: number; output?: number };
	cost?: {
		input?: number;
		output?: number;
		cache_read?: number;
		cache_write?: number;
	};
};

type SourceProvider = {
	id?: string;
	name?: string;
	env?: string[];
	npm?: string;
	api?: string;
	doc?: string;
	models?: Record<string, SourceModel>;
};

type SourceCatalog = Record<string, SourceProvider>;

const SOURCE_URL = "https://models.dev/api.json";
const CHECK_ONLY = process.argv.includes("--check");
const PROVIDER_FILTER = process.argv.find((value) => value.startsWith("--provider="))?.split("=", 2)[1]?.trim();
const CATALOG_PROVIDER = process.argv.find((value) => value.startsWith("--catalog-provider="))?.split("=", 2)[1]?.trim();
const EXISTING_PROVIDERS_ONLY = process.argv.includes("--existing-providers-only");
const DATA_ROOT = path.resolve(process.cwd(), "../../packages/data/catalog/src/data");
const PROVIDERS_ROOT = path.join(DATA_ROOT, "api_providers");
const PRICING_ROOT = path.join(DATA_ROOT, "pricing");

function slug(value: unknown, fallback = ""): string {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._:/+@-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || fallback;
}

async function readJson<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function jsonFiles(root: string, fileName: string): Promise<string[]> {
	const output: string[] = [];
	async function visit(directory: string) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) await visit(entryPath);
			else if (entry.name === fileName) output.push(entryPath);
		}
	}
	await visit(root);
	return output.sort();
}

function unique(values: unknown[]): string[] {
	return [...new Set(values.map((value) => slug(value)).filter(Boolean))];
}

function positiveInteger(value: unknown): number | null {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : null;
}

function primaryCapability(model: SourceModel): string {
	const outputs = unique(model.modalities?.output ?? []);
	const inputs = unique(model.modalities?.input ?? []);
	if (outputs.includes("image")) return "image.generate";
	if (outputs.includes("video")) return "video.generate";
	if (outputs.includes("audio")) return "audio.generate";
	if (inputs.includes("embedding") || outputs.includes("embedding")) return "embeddings";
	return "text.generate";
}

function pricingFileSlug(value: string): string {
	return slug(value).replace(/[^a-z0-9._-]+/g, "-");
}

function pricingRule(meter: string, price: number): JsonObject {
	return {
		meter,
		unit: "token",
		unit_size: 1_000_000,
		price_per_unit: price,
		currency: "USD",
		pricing_plan: "standard",
		note: null,
		match: [],
		priority: 100,
		region: null,
		cache_duration_seconds: null,
		conditions: [],
		source: null,
	};
}

export function modelsDevMeters(model: SourceModel): Record<string, number> | null {
	const cost = model.cost;
	if (!cost || typeof cost.input !== "number" || typeof cost.output !== "number") return null;
	return Object.fromEntries(Object.entries({
		input_text_tokens: cost.input,
		cached_read_text_tokens: cost.cache_read,
		cached_write_text_tokens: cost.cache_write,
		output_text_tokens: cost.output,
	}).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));
}

function isSimplePricing(value: JsonObject): boolean {
	return Array.isArray(value.rules) && value.rules.every((rule: JsonObject) =>
		rule?.pricing_plan === "standard"
		&& (!Array.isArray(rule.match) || rule.match.length === 0)
		&& (!Array.isArray(rule.conditions) || rule.conditions.length === 0)
		&& !rule.effective_to,
	);
}

export function mergeModelsDevPricing(value: JsonObject, meters: Record<string, number>, accessedAt: string): boolean {
	if (!isSimplePricing(value)) return false;
	let changed = false;
	const byMeter = new Map((value.rules as JsonObject[]).map((rule) => [rule.meter, rule]));
	for (const [meter, price] of Object.entries(meters)) {
		const current = byMeter.get(meter);
		if (!current) {
			(value.rules as JsonObject[]).push(pricingRule(meter, price));
			changed = true;
		} else if (Number(current.price_per_unit) !== price) {
			current.price_per_unit = price;
			changed = true;
		}
	}
	if (changed) {
		(value.rules as JsonObject[]).sort((left, right) => String(left.meter).localeCompare(String(right.meter)));
		value.verification = {
			status: "partial",
			checked_at: accessedAt,
			notes: "Pricing synchronized from models.dev for review against the provider source.",
		};
	}
	return changed;
}

function capability(model: SourceModel): JsonObject {
	return {
		capability_id: primaryCapability(model),
		status: "active",
		params: [],
		reasoning: model.reasoning ?? null,
		tool_call: model.tool_call ?? null,
		structured_output: model.structured_output ?? null,
		temperature: null,
		attachment: model.attachment ?? null,
		input_modalities: null,
		output_modalities: null,
		modes: [],
	};
}

function externalProvider(providerSlug: string, provider: SourceProvider, accessedAt: string): JsonObject {
	return {
		api_provider_id: providerSlug,
		api_provider_name: provider.name?.trim() || providerSlug,
		provider_family_id: null,
		offer_label: null,
		offer_scope: "specialized",
		description: null,
		link: provider.doc ?? provider.api ?? null,
		residency_mode: null,
		default_execution_regions: null,
		default_data_regions: null,
		zero_data_retention: null,
		residency_source_url: null,
		prompt_training_policy: null,
		prompt_training_notes: null,
		prompt_training_source_url: null,
		user_identifier_policy: null,
		user_identifier_notes: null,
		privacy_policy_url: null,
		terms_of_service_url: null,
		regional_pricing_mode: null,
		regional_pricing_uplift_percent: null,
		pricing_source_url: null,
		regional_pricing_notes: null,
		country_code: null,
		status: "Active",
		colour: null,
		gateway_kind: "catalogue",
		routable: false,
		routing_enabled: false,
		sdk_package: provider.npm ?? null,
		api_base_url: provider.api ?? null,
		docs_url: provider.doc ?? null,
		auth_env: provider.env ?? [],
		api_formats: [],
		service_tiers: [],
		sources: [{
			kind: "models.dev",
			url: SOURCE_URL,
			accessed_at: accessedAt,
			notes: "Provider metadata and model support enrichment; not a Phaseo-routable offer.",
		}],
		verification: {
			status: "partial",
			checked_at: accessedAt,
			notes: "Imported from the public models.dev provider registry.",
		},
	};
}

function providerModel(
	providerSlug: string,
	canonicalModelSlug: string,
	sourceModelSlug: string,
	model: SourceModel,
	accessedAt: string,
): JsonObject {
	const inputModalities = unique(model.modalities?.input ?? []);
	const outputModalities = unique(model.modalities?.output ?? []);
	return {
		api_model_id: canonicalModelSlug,
		provider_api_model_id: `${providerSlug}:${canonicalModelSlug}`,
		provider_model_slug: sourceModelSlug,
		internal_model_id: canonicalModelSlug,
		is_active_gateway: false,
		quantization_scheme: null,
		input_modalities: inputModalities.join(",") || null,
		output_modalities: outputModalities.join(",") || null,
		context_length: positiveInteger(model.limit?.context),
		max_output_tokens: positiveInteger(model.limit?.output),
		effective_from: null,
		effective_to: null,
		capabilities: [capability(model)],
		routing_status: "active",
		routable: false,
		regions: { execution: ["global"], data: ["global"] },
		service_tiers: [],
		api: { formats: [], endpoint: null, deployment: null },
		sources: [{
			kind: "models.dev",
			url: SOURCE_URL,
			accessed_at: accessedAt,
			notes: `Provider model slug: ${sourceModelSlug}`,
		}],
		verification: {
			status: "partial",
			checked_at: accessedAt,
			notes: "Provider support imported from models.dev; routing remains disabled.",
		},
		rate_limits: [],
	};
}

async function writeJsonIfChanged(filePath: string, value: unknown): Promise<boolean> {
	const next = `${JSON.stringify(value, null, 2)}\n`;
	const current = await readFile(filePath, "utf8").catch(() => "");
	if (current === next) return false;
	if (!CHECK_ONLY) {
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, next, "utf8");
	}
	return true;
}

async function main() {
	const response = await fetch(SOURCE_URL, { headers: { accept: "application/json" } });
	if (!response.ok) throw new Error(`models.dev returned ${response.status}`);
	const catalog = await response.json() as SourceCatalog;
	const accessedAt = new Date().toISOString();

	const modelFiles = await jsonFiles(path.join(DATA_ROOT, "models"), "model.json");
	const canonicalModels = new Set<string>();
	for (const filePath of modelFiles) {
		const model = await readJson<JsonObject>(filePath);
		if (model.model_id) canonicalModels.add(slug(model.model_id));
	}

	const aliases = new Map<string, string>();
	for (const filePath of await jsonFiles(path.join(DATA_ROOT, "aliases"), "alias.json")) {
		const alias = await readJson<JsonObject>(filePath);
		const target = slug(alias.resolved_model_id ?? alias.resolved_api_model_id);
		if (alias.is_enabled !== false && canonicalModels.has(target)) aliases.set(slug(alias.alias_slug), target);
	}

	const providerRouteAliases = new Map<string, string>();
	const existingProviders = new Map<string, { provider: JsonObject; models: JsonObject[] }>();
	for (const entry of await readdir(PROVIDERS_ROOT, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const directory = path.join(PROVIDERS_ROOT, entry.name);
		const providerPath = path.join(directory, "api_provider.json");
		const modelsPath = path.join(directory, "models.json");
		const provider = await readJson<JsonObject>(providerPath).catch(() => null);
		if (!provider?.api_provider_id) continue;
		const providerSlug = slug(provider.api_provider_id);
		const models = await readJson<JsonObject[]>(modelsPath).catch(() => []);
		existingProviders.set(providerSlug, { provider, models });
		for (const model of models) {
			const target = slug(model.internal_model_id ?? model.api_model_id);
			const upstream = slug(model.provider_model_slug);
			if (canonicalModels.has(target) && upstream) providerRouteAliases.set(`${providerSlug}:${upstream}`, target);
		}
	}

	let addedMappings = 0;
	let unmatchedModels = 0;
	let changedFiles = 0;
	let createdProviders = 0;
	let pricingFilesChanged = 0;
	const pricingByKey = new Map<string, { path: string; value: JsonObject }>();
	for (const filePath of await jsonFiles(PRICING_ROOT, "pricing.json")) {
		const pricing = await readJson<JsonObject>(filePath);
		pricingByKey.set(`${slug(pricing.api_provider_id)}:${slug(pricing.api_model_id)}:${slug(pricing.capability_id)}`, { path: filePath, value: pricing });
	}

	for (const sourceProvider of Object.values(catalog).filter((provider) =>
		provider.id && (!PROVIDER_FILTER || slug(provider.id) === slug(PROVIDER_FILTER)),
	)) {
		const providerSlug = slug(CATALOG_PROVIDER ?? sourceProvider.id);
		const existing = existingProviders.get(providerSlug);
		if (!existing && EXISTING_PROVIDERS_ONLY) continue;
		const provider = existing?.provider ?? externalProvider(providerSlug, sourceProvider, accessedAt);
		const models = [...(existing?.models ?? [])];

		for (const sourceModel of Object.values(sourceProvider.models ?? {})) {
			const sourceModelSlug = slug(sourceModel.id);
			const canonicalModelSlug = canonicalModels.has(sourceModelSlug)
				? sourceModelSlug
				: aliases.get(sourceModelSlug)
					?? providerRouteAliases.get(`${providerSlug}:${sourceModelSlug}`)
					?? null;
			if (!canonicalModelSlug) {
				unmatchedModels += 1;
				continue;
			}
			const capabilityId = primaryCapability(sourceModel);
			const meters = capabilityId === "text.generate" ? modelsDevMeters(sourceModel) : null;
			if (meters) {
				const pricingKey = `${providerSlug}:${canonicalModelSlug}:${capabilityId}`;
				const current = pricingByKey.get(pricingKey);
				if (current) {
					if (mergeModelsDevPricing(current.value, meters, accessedAt)) {
						if (await writeJsonIfChanged(current.path, current.value)) pricingFilesChanged += 1;
					}
				} else {
					const pricing = {
						key: `${providerSlug}:${canonicalModelSlug}:${capabilityId}`,
						api_provider_id: providerSlug,
						provider_slug: providerSlug,
						api_model_id: canonicalModelSlug,
						capability_id: capabilityId,
						rules: Object.entries(meters).map(([meter, price]) => pricingRule(meter, price)),
						regions: [],
						service_tiers: ["standard"],
						sources: [],
						verification: {
							status: "partial",
							checked_at: accessedAt,
							notes: "Pricing synchronized from models.dev for review against the provider source.",
						},
					};
					const target = path.join(PRICING_ROOT, providerSlug, pricingFileSlug(canonicalModelSlug), capabilityId, "pricing.json");
					if (await writeJsonIfChanged(target, pricing)) pricingFilesChanged += 1;
					pricingByKey.set(pricingKey, { path: target, value: pricing });
				}
			}
			const existingIndex = models.findIndex((model) =>
				slug(model.internal_model_id ?? model.api_model_id) === canonicalModelSlug,
			);
			if (existingIndex >= 0) {
				const existingModel = models[existingIndex];
				const modelsDevSource = Array.isArray(existingModel.sources)
					? existingModel.sources.find((source: JsonObject) => source?.kind === "models.dev")
					: null;
				if (!modelsDevSource) continue;
				models[existingIndex] = providerModel(
					providerSlug,
					canonicalModelSlug,
					sourceModelSlug,
					sourceModel,
					modelsDevSource.accessed_at ?? accessedAt,
				);
				continue;
			}
			models.push(providerModel(providerSlug, canonicalModelSlug, sourceModelSlug, sourceModel, accessedAt));
			addedMappings += 1;
		}

		models.sort((left, right) =>
			slug(left.api_model_id).localeCompare(slug(right.api_model_id))
			|| slug(left.provider_model_slug).localeCompare(slug(right.provider_model_slug)),
		);
		const directory = path.join(PROVIDERS_ROOT, providerSlug);
		if (!existing) createdProviders += 1;
		if (await writeJsonIfChanged(path.join(directory, "api_provider.json"), provider)) changedFiles += 1;
		if (await writeJsonIfChanged(path.join(directory, "models.json"), models)) changedFiles += 1;
	}

	console.log(`[models.dev json] providers_created=${createdProviders} mappings_added=${addedMappings} unmatched_models=${unmatchedModels} changed_files=${changedFiles} pricing_files_changed=${pricingFilesChanged}${CHECK_ONLY ? " check_only=true" : ""}`);
	if (CHECK_ONLY && (changedFiles || pricingFilesChanged)) process.exitCode = 1;
}

const direct = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (direct) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
