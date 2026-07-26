import { assertOk, client, isDryRun, logWrite } from "./supa";
import { chunk } from "./util";
import { DATA_ROOT, DIR_ALIASES } from "./paths";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type DbClient = ReturnType<typeof client>;

const PAGE_SIZE = 1_000;

function asText(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asTextArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(asText).filter((item): item is string => Boolean(item));
    const text = asText(value);
    return text ? text.split(",").map(item => item.trim()).filter(Boolean) : [];
}

function modelStatus(value: unknown): string {
    switch (String(value ?? "").trim().toLowerCase()) {
        case "retired": return "retired";
        case "deprecated": return "deprecated";
        case "withheld": return "disabled";
        case "announced":
        case "rumoured": return "draft";
        default: return "active";
    }
}

function providerStatus(value: unknown): string {
    switch (String(value ?? "").trim().toLowerCase()) {
        case "alpha": return "alpha";
        case "beta": return "beta";
        case "notready": return "not_ready";
        case "disabled": return "disabled";
        case "deprecated": return "deprecated";
        case "external": return "external";
        default: return "active";
    }
}

function routeStatus(value: unknown): string {
    switch (String(value ?? "").trim().toLowerCase()) {
        case "disabled": return "disabled";
        case "retired": return "retired";
        case "active": return "active";
        default: return "degraded";
    }
}

function slug(value: unknown, fallback = "standard"): string {
    const normalized = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
    return normalized || fallback;
}

export function isFreeModelVariant(value: unknown): boolean {
    return String(value ?? "").trim().toLowerCase().endsWith(":free");
}

export function v2RouteModelSlug(
    row: Record<string, any>,
    canonicalModelSlug: (value: unknown) => string,
    authoredProviderModel?: Record<string, any>,
): string {
    const authoredModelSlug = asText(authoredProviderModel?.canonical_model_id);
    if (authoredModelSlug) return authoredModelSlug;
    if (isFreeModelVariant(row.api_model_id)) {
        throw new Error(
            `Free provider route ${String(row.provider_api_model_id ?? row.api_model_id)} is missing authored canonical_model_id`,
        );
    }
    const baseModelSlug = canonicalModelSlug(
        row.model_id ?? row.internal_model_id ?? row.api_model_id,
    );
    return baseModelSlug;
}

export function mergeProviderModels(
    legacyProviderModels: Record<string, any>[],
    authoredProviderModels: Map<string, Record<string, any>>,
): Record<string, any>[] {
    const rowsById = new Map(
        legacyProviderModels.map(row => [String(row.provider_api_model_id), row]),
    );
    for (const [providerModelId, authored] of authoredProviderModels) {
        rowsById.set(providerModelId, {
            ...(rowsById.get(providerModelId) ?? {}),
            ...authored,
        });
    }
    return [...rowsById.values()];
}

export function pricingModelPart(modelKey: string): { providerSlug: string; apiModelId: string } | null {
    const firstColon = modelKey.indexOf(":");
    const lastColon = modelKey.lastIndexOf(":");
    if (firstColon <= 0 || lastColon <= firstColon + 1) return null;
    const providerSlug = modelKey.slice(0, firstColon);
    return {
        providerSlug,
        apiModelId: modelKey.slice(firstColon + 1, lastColon),
    };
}

export type V2ModelPreflightIssue = {
    source_type: string;
    source_key: string;
    issue_code: string;
    details: Record<string, unknown>;
};

export type V2ModelPreflight = {
    models: Record<string, any>[];
    modelSlugAliases: Map<string, string>;
    issues: V2ModelPreflightIssue[];
};

export type V2BenchmarkPreflight = {
    rows: Record<string, any>[];
    issues: V2ModelPreflightIssue[];
};

function validCanonicalSlug(modelSlug: string, labSlug: string): boolean {
    const [prefix, suffix] = modelSlug.split("/", 2);
    return prefix === labSlug && Boolean(suffix);
}

export function preflightV2Models(
    legacyModels: Record<string, any>[],
    authoredAliases: Map<string, string>,
): V2ModelPreflight {
    const modelSlugAliases = new Map<string, string>();
    const issues: V2ModelPreflightIssue[] = [];
    const canonicalModels = new Map<string, Record<string, any>>();

    for (const row of legacyModels) {
        const legacySlug = String(row.model_id ?? "").trim();
        const labSlug = String(row.organisation_id ?? "").trim();
        if (!legacySlug) continue;

        const authoredCanonicalSlug = authoredAliases.get(legacySlug) ?? legacySlug;
        const canonicalSlug = authoredCanonicalSlug.trim();
        if (!validCanonicalSlug(canonicalSlug, labSlug)) {
            issues.push({
                source_type: "v2_model_preflight",
                source_key: legacySlug,
                issue_code: "unresolved_model_slug_prefix",
                details: { model_slug: legacySlug, lab_slug: labSlug, authored_canonical_slug: canonicalSlug },
            });
            continue;
        }

        if (canonicalSlug !== legacySlug) modelSlugAliases.set(legacySlug, canonicalSlug);
        const existing = canonicalModels.get(canonicalSlug);
        if (existing && String(existing.model_id) !== legacySlug) {
            // Prefer the already-canonical legacy row. Both legacy rows remain untouched;
            // V2 receives one deterministic identity and the collision is auditable.
            if (String(existing.model_id) !== canonicalSlug) {
                canonicalModels.set(canonicalSlug, { ...row, model_id: canonicalSlug });
            }
            issues.push({
                source_type: "v2_model_preflight",
                source_key: legacySlug,
                issue_code: "canonical_model_duplicate",
                details: { model_slug: legacySlug, canonical_model_slug: canonicalSlug },
            });
            continue;
        }
        canonicalModels.set(canonicalSlug, { ...row, model_id: canonicalSlug });
    }

    return { models: [...canonicalModels.values()], modelSlugAliases, issues };
}

export function preflightV2Benchmarks(
    legacyResults: Record<string, any>[],
    benchmarkIds: Set<string>,
    modelSlugs: Set<string>,
    canonicalModelSlug: (value: unknown) => string,
): V2BenchmarkPreflight {
    const issues: V2ModelPreflightIssue[] = [];
    const rows = legacyResults.flatMap(row => {
        const modelSlug = canonicalModelSlug(row.model_id);
        const benchmarkId = String(row.benchmark_id ?? "");
        if (!modelSlugs.has(modelSlug) || !benchmarkIds.has(benchmarkId)) {
            issues.push({
                source_type: "v2_benchmark_preflight",
                source_key: String(row.id ?? row.result_key ?? ""),
                issue_code: !modelSlugs.has(modelSlug) ? "unresolved_benchmark_model" : "unresolved_benchmark_id",
                details: { model_id: row.model_id, canonical_model_slug: modelSlug, benchmark_id: benchmarkId },
            });
            return [];
        }
        return [{
            result_id: row.id,
            model_slug: modelSlug,
            benchmark_id: benchmarkId,
            score: row.score ?? null,
            score_numeric: row.score_numeric ?? null,
            is_self_reported: Boolean(row.is_self_reported),
            other_info: row.other_info ?? null,
            source_link: row.source_link ?? null,
            rank: row.rank ?? null,
            occur_idx: row.occur_idx ?? null,
            variant: row.variant ?? null,
            result_key: row.result_key ?? null,
            created_at: row.created_at ?? null,
            updated_at: row.updated_at ?? null,
        }];
    });
    return { rows, issues };
}

async function fetchAll(supa: DbClient, table: string, columns = "*"): Promise<Record<string, any>[]> {
    const rows: Record<string, any>[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const result = await supa.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
        const page = assertOk(result, `v2 sync select ${table}`) as Record<string, any>[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
    }
}

async function upsertChunks(
    supa: DbClient,
    table: string,
    rows: Record<string, any>[],
    onConflict: string,
) {
    for (const group of chunk(rows, 500)) {
        assertOk(
            await supa.from(table).upsert(group, { onConflict }),
            `v2 sync upsert ${table}`,
        );
    }
}

async function deleteByIds(
    supa: DbClient,
    table: string,
    idColumn: string,
    ids: string[],
) {
    for (const group of chunk(ids, 200)) {
        assertOk(
            await supa.from(table).delete().in(idColumn, group),
            `v2 sync delete stale ${table}`,
        );
    }
}

function sourceJsonMaps(): {
    models: Map<string, Record<string, any>>;
    modelVariants: Map<string, Record<string, any>>;
    providers: Map<string, Record<string, any>>;
    providerModels: Map<string, Record<string, any>>;
    aliases: Map<string, string>;
} {
    const models = new Map<string, Record<string, any>>();
    const modelVariants = new Map<string, Record<string, any>>();
    const providers = new Map<string, Record<string, any>>();
    const providerModels = new Map<string, Record<string, any>>();
    const aliases = new Map<string, string>();
    const providerRoot = join(DATA_ROOT, "api_providers");
    const aliasRoot = DIR_ALIASES;
    const modelRoot = join(DATA_ROOT, "models");
    for (const providerSlug of readdirSync(providerRoot)) {
        const providerDir = join(providerRoot, providerSlug);
        const providerPath = join(providerDir, "api_provider.json");
        if (existsSync(providerPath)) {
            const provider = JSON.parse(readFileSync(providerPath, "utf8")) as Record<string, any>;
            if (provider.api_provider_id) providers.set(String(provider.api_provider_id), provider);
        }
        const modelsPath = join(providerDir, "models.json");
        if (!existsSync(modelsPath)) continue;
        const entries = JSON.parse(readFileSync(modelsPath, "utf8")) as unknown;
        for (const entry of Array.isArray(entries) ? entries : []) {
            if (entry?.provider_api_model_id) {
                providerModels.set(String(entry.provider_api_model_id), {
                    ...entry,
                    provider_id: providerSlug,
                });
            }
        }
    }
    const walk = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const file = join(directory, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith(".json")) {
                const model = JSON.parse(readFileSync(file, "utf8")) as Record<string, any>;
                if (model.model_id) {
                    models.set(String(model.model_id), model);
                    for (const variant of Array.isArray(model.variants) ? model.variants : []) {
                        if (!variant?.model_id) continue;
                        modelVariants.set(String(variant.model_id), {
                            ...variant,
                            base_model_id: model.model_id,
                        });
                    }
                }
            }
        }
    };
    walk(modelRoot);
    for (const aliasDir of readdirSync(aliasRoot)) {
        const aliasPath = join(aliasRoot, aliasDir, "alias.json");
        if (!existsSync(aliasPath)) continue;
        const alias = JSON.parse(readFileSync(aliasPath, "utf8")) as Record<string, any>;
        if (alias.is_enabled === false) continue;
        if (alias.alias_slug && alias.resolved_model_id) {
            aliases.set(String(alias.alias_slug), String(alias.resolved_model_id));
        }
    }
    return { models, modelVariants, providers, providerModels, aliases };
}

export async function syncV2Catalogue(): Promise<void> {
    const supa = client();
    const source = sourceJsonMaps();

    const [organisations, models, providers, providerModels, aliases, pricingRules, capabilities, benchmarks, benchmarkResults] = await Promise.all([
        fetchAll(supa, "data_organisations", "organisation_id,name,country_code,description,colour"),
        fetchAll(supa, "data_models", "model_id,organisation_id,name,description,status,hidden,input_types,output_types,family_id,announcement_date,release_date,deprecation_date,retirement_date,previous_model_id,license,api_model_id,id"),
        fetchAll(supa, "data_api_providers", "api_provider_id,api_provider_name,provider_family_id,status,routing_status,country_code,description,link,colour,prompt_training_policy,residency_mode,default_execution_regions,default_data_regions"),
        fetchAll(supa, "data_api_provider_models", "provider_api_model_id,provider_id,api_model_id,provider_model_slug,internal_model_id,is_active_gateway,input_modalities,output_modalities,context_length,max_output_tokens,effective_from,effective_to,routing_status,quantization_scheme,model_id"),
        fetchAll(supa, "data_api_model_aliases", "alias_slug,api_model_id,channel,is_enabled"),
        fetchAll(supa, "data_api_pricing_rules", "*"),
        fetchAll(supa, "data_api_provider_model_capabilities", "provider_api_model_id,capability_id,status,max_input_tokens,max_output_tokens,params,notes"),
        fetchAll(supa, "data_benchmarks", "id,name,category,link,total_models,ascending_order,type,created_at,updated_at"),
        fetchAll(supa, "data_benchmark_results", "id,model_id,benchmark_id,score,score_numeric,is_self_reported,other_info,source_link,rank,occur_idx,variant,result_key,created_at,updated_at"),
    ]);

    const organisationIds = new Set(organisations.map(row => String(row.organisation_id)));

    // Provider/model JSON is authoritative. Legacy rows are retained only as a
    // compatibility source for fields that have not moved into JSON yet.
    providerModels.splice(
        0,
        providerModels.length,
        ...mergeProviderModels(providerModels, source.providerModels),
    );

    const modelPreflight = preflightV2Models(models, source.aliases);
    const canonicalModels = modelPreflight.models;
    const modelSlugAliases = modelPreflight.modelSlugAliases;
    const canonicalModelSlug = (value: unknown) => modelSlugAliases.get(String(value ?? "").trim()) ?? String(value ?? "").trim();
    const modelById = new Map(canonicalModels.map(row => [String(row.model_id), row]));
    const benchmarkRows = benchmarks.map(row => ({
        benchmark_id: row.id,
        name: row.name,
        category: row.category ?? null,
        link: row.link ?? null,
        total_models: row.total_models ?? null,
        ascending_order: row.ascending_order ?? false,
        benchmark_type: row.type ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    }));
    const benchmarkPreflight = preflightV2Benchmarks(
        benchmarkResults,
        new Set(benchmarkRows.map(row => String(row.benchmark_id))),
        new Set(modelById.keys()),
        canonicalModelSlug,
    );

    if (isDryRun()) {
        logWrite("public.v2_*", "SYNC", {
            source: "legacy tables after JSON import",
            legacy_models: models.length,
            canonical_models: canonicalModels.length,
            authored_variant_models: source.modelVariants.size,
            canonicalized_models: modelSlugAliases.size,
            benchmark_results: benchmarkResults.length,
            preflight_issues: [...modelPreflight.issues, ...benchmarkPreflight.issues],
        });
        return;
    }

    if (modelPreflight.issues.length) {
        await upsertChunks(supa, "v2_catalogue_backfill_issues", modelPreflight.issues, "source_type,source_key,issue_code");
    }
    const providerModelByApiKey = new Map<string, Record<string, any>>();
    for (const row of providerModels) {
        const key = `${row.provider_id}:${row.api_model_id}`;
        const previous = providerModelByApiKey.get(key);
        const isExactRoute = row.provider_api_model_id === key;
        const previousIsExactRoute = previous?.provider_api_model_id === key;
        if (!previous || isExactRoute || (!previousIsExactRoute && Boolean(row.is_active_gateway) && !Boolean(previous.is_active_gateway))) {
            providerModelByApiKey.set(key, row);
        }
    }

    await upsertChunks(supa, "v2_labs", organisations.map(row => ({
        lab_slug: row.organisation_id,
        name: row.name,
        country_code: asText(row.country_code) ?? "xx",
        description: row.description ?? null,
        status: "active",
        routable: false,
        metadata: {
            source: "json",
            legacy_organisation_id: row.organisation_id,
            colour: row.colour ?? null,
            display_name: row.name ?? null,
        },
    })), "lab_slug");

    const baseModelRows = canonicalModels.filter(row => organisationIds.has(String(row.organisation_id))).map(row => ({
        model_slug: row.model_id,
        lab_slug: row.organisation_id,
        name: row.name,
        description: row.description ?? null,
        status: modelStatus(row.status),
        hidden: Boolean(row.hidden),
        input_modalities: asTextArray(row.input_types).map(value => value.toLowerCase()),
        output_modalities: asTextArray(row.output_types).map(value => value.toLowerCase()),
        family_slug: row.family_id ?? null,
        previous_model_slug: canonicalModelSlug(row.previous_model_id) || null,
        removal_date: source.models.get(String(row.model_id))?.removal_date ?? null,
        replacement_model_slug: canonicalModelSlug(source.models.get(String(row.model_id))?.replacement_model_id) || null,
        license: row.license ?? null,
        license_url: source.models.get(String(row.model_id))?.license_url ?? null,
        announced_at: row.announcement_date ?? null,
        released_at: row.release_date ?? null,
        deprecated_at: row.deprecation_date ?? null,
        retired_at: row.retirement_date ?? null,
        variant_kind: "standard",
        base_model_slug: null,
        metadata: {
            source: "json",
            legacy_model_id: row.model_id,
            legacy_api_model_id: row.api_model_id ?? null,
            license: row.license ?? null,
            license_url: source.models.get(String(row.model_id))?.license_url ?? null,
            model_type: source.models.get(String(row.model_id))?.model_type ?? null,
            knowledge_cutoff: source.models.get(String(row.model_id))?.knowledge_cutoff ?? null,
            limits: source.models.get(String(row.model_id))?.limits ?? null,
            modalities: source.models.get(String(row.model_id))?.modalities ?? null,
            reasoning: source.models.get(String(row.model_id))?.reasoning ?? null,
            capabilities: source.models.get(String(row.model_id))?.capabilities ?? null,
            open_weights: source.models.get(String(row.model_id))?.open_weights ?? null,
            sources: source.models.get(String(row.model_id))?.sources ?? [],
            verification: source.models.get(String(row.model_id))?.verification ?? null,
        },
    }));
    const baseModelRowsBySlug = new Map(baseModelRows.map(row => [String(row.model_slug), row]));
    const variantModelRows = [...source.modelVariants.values()].map(variant => {
        const baseModelSlug = canonicalModelSlug(variant.base_model_id);
        const base = baseModelRowsBySlug.get(baseModelSlug);
        if (!base) {
            throw new Error(`Authored model variant ${String(variant.model_id)} references missing base model ${baseModelSlug}`);
        }
        return {
            ...base,
            model_slug: String(variant.model_id),
            name: String(variant.name),
            variant_kind: String(variant.variant_kind),
            base_model_slug: baseModelSlug,
            metadata: {
                ...base.metadata,
                variant_kind: variant.variant_kind,
                base_model_slug: baseModelSlug,
                source: "json",
            },
        };
    });
    await upsertChunks(supa, "v2_models", [...baseModelRows, ...variantModelRows], "model_slug");

    const providerRows = providers.map(row => {
        const sourceProvider = source.providers.get(String(row.api_provider_id));
        const sourceRoutable = typeof sourceProvider?.routable === "boolean" ? sourceProvider.routable : null;
        const routable = sourceRoutable ?? String(row.routing_status ?? "").toLowerCase() === "active";
        const routingEnabled = sourceRoutable === false
            ? false
            : typeof sourceProvider?.routing_enabled === "boolean"
                ? sourceProvider.routing_enabled
                : String(row.routing_status ?? "").toLowerCase() === "active";
        return {
        provider_slug: row.api_provider_id,
        lab_slug: organisationIds.has(String(row.api_provider_id))
            ? row.api_provider_id
            : organisationIds.has(String(row.provider_family_id))
                ? row.provider_family_id
                : null,
        name: row.api_provider_name,
        status: sourceRoutable === false ? "external" : providerStatus(row.status),
        routing_enabled: routingEnabled,
        routable,
        country_code: asText(row.country_code) ?? "xx",
        ...(sourceProvider?.stream_cancellation_support !== undefined ? {
            stream_cancellation_support: sourceProvider.stream_cancellation_support,
            stream_cancellation_stops_provider_billing:
                sourceProvider.stream_cancellation_stops_provider_billing ?? null,
            stream_cancellation_usage_recovery:
                sourceProvider.stream_cancellation_usage_recovery ?? "unknown",
            stream_cancellation_evidence_kind:
                sourceProvider.stream_cancellation_evidence_kind ?? "none",
            stream_cancellation_source_url:
                sourceProvider.stream_cancellation_source_url ?? null,
            stream_cancellation_verified_at:
                sourceProvider.stream_cancellation_verified_at ?? null,
        } : {}),
        metadata: {
            source: "json",
            legacy_provider_id: row.api_provider_id,
            provider_family_id: row.provider_family_id ?? null,
            description: row.description ?? null,
            link: row.link ?? null,
            colour: row.colour ?? null,
            prompt_training_policy: row.prompt_training_policy ?? null,
            residency_mode: row.residency_mode ?? null,
            default_execution_regions: row.default_execution_regions ?? null,
            default_data_regions: row.default_data_regions ?? null,
            gateway_kind: sourceProvider?.gateway_kind ?? null,
            routable: sourceProvider?.routable ?? null,
            routing_enabled: sourceProvider?.routing_enabled ?? null,
            sdk_package: sourceProvider?.sdk_package ?? null,
            api_base_url: sourceProvider?.api_base_url ?? null,
            docs_url: sourceProvider?.docs_url ?? null,
            auth_env: sourceProvider?.auth_env ?? null,
            api_formats: sourceProvider?.api_formats ?? [],
            service_tiers: sourceProvider?.service_tiers ?? [],
            sources: sourceProvider?.sources ?? [],
            verification: sourceProvider?.verification ?? null,
        },
    }; });
    await upsertChunks(supa, "v2_providers", providerRows, "provider_slug");
    const routableLabs = new Set(providerRows.filter(row => row.routable && row.routing_enabled && row.status !== "disabled" && row.status !== "deprecated").map(row => String(row.lab_slug ?? "")));
    await upsertChunks(supa, "v2_labs", organisations.map(row => ({
        lab_slug: row.organisation_id,
        name: row.name,
        country_code: asText(row.country_code) ?? "xx",
        description: row.description ?? null,
        status: "active",
        routable: routableLabs.has(String(row.organisation_id)),
        metadata: {
            source: "json",
            legacy_organisation_id: row.organisation_id,
            colour: row.colour ?? null,
            display_name: row.name ?? null,
            routability_derived_from_provider_offers: true,
        },
    })), "lab_slug");

    const providerRegions = providerRows.flatMap(row => {
        const execution = asTextArray(row.metadata?.default_execution_regions);
        const data = new Set(asTextArray(row.metadata?.default_data_regions).map(value => value.toLowerCase()));
        return execution.map(region => ({
            provider_slug: row.provider_slug,
            region_code: region.toLowerCase(),
            display_name: region.toUpperCase(),
            execution_supported: true,
            data_residency_supported: data.has(region.toLowerCase()),
            status: row.status === "disabled" ? "disabled" : "active",
            routing_enabled: row.routing_enabled,
            metadata: { source: "json", default_execution_region: true },
        }));
    });
    await upsertChunks(supa, "v2_provider_regions", providerRegions, "provider_slug,region_code");

    const providerRegionsByProvider = new Map<string, string[]>();
    for (const region of providerRegions) {
        const regions = providerRegionsByProvider.get(region.provider_slug) ?? [];
        regions.push(region.region_code);
        providerRegionsByProvider.set(region.provider_slug, regions);
    }

    const routeRows = providerModels.filter(row => modelById.has(canonicalModelSlug(row.model_id ?? row.internal_model_id ?? row.api_model_id))).map(row => ({
        provider_model_id: row.provider_api_model_id,
        model_slug: v2RouteModelSlug(
            row,
            canonicalModelSlug,
            source.providerModels.get(String(row.provider_api_model_id)),
        ),
        provider_slug: row.provider_id,
        provider_model_slug: row.provider_model_slug,
        status: routeStatus(row.routing_status),
        routing_enabled: Boolean(row.is_active_gateway) && String(row.routing_status ?? "").toLowerCase() === "active",
        input_modalities: asTextArray(row.input_modalities),
        output_modalities: asTextArray(row.output_modalities),
        context_length: Number(row.context_length) > 0 ? Number(row.context_length) : null,
        max_output_tokens: Number(row.max_output_tokens) > 0 ? Number(row.max_output_tokens) : null,
        effective_from: row.effective_from ?? null,
        effective_to: row.effective_to && row.effective_from && new Date(row.effective_to) <= new Date(row.effective_from) ? null : row.effective_to ?? null,
        regions: providerRegionsByProvider.get(String(row.provider_id)) ?? [],
        metadata: {
            source: "json",
            legacy_provider_api_model_id: row.provider_api_model_id,
            quantization_scheme: row.quantization_scheme ?? null,
            routing_status: source.providerModels.get(String(row.provider_api_model_id))?.routing_status ?? null,
            routable: source.providerModels.get(String(row.provider_api_model_id))?.routable ?? null,
            regions: source.providerModels.get(String(row.provider_api_model_id))?.regions ?? null,
            service_tiers: source.providerModels.get(String(row.provider_api_model_id))?.service_tiers ?? [],
            api: source.providerModels.get(String(row.provider_api_model_id))?.api ?? null,
            sources: source.providerModels.get(String(row.provider_api_model_id))?.sources ?? [],
            verification: source.providerModels.get(String(row.provider_api_model_id))?.verification ?? null,
        },
    }));
    await upsertChunks(supa, "v2_model_provider_routes", routeRows, "provider_model_id");
    const desiredRouteIds = new Set(routeRows.map(row => String(row.provider_model_id)));
    const excludedRouteIds = new Set(
        providerModels
            .filter(row => !modelById.has(canonicalModelSlug(row.model_id ?? row.internal_model_id ?? row.api_model_id)))
            .map(row => String(row.provider_api_model_id ?? ""))
            .filter(Boolean),
    );
    const existingRouteRows = await fetchAll(supa, "v2_model_provider_routes", "provider_model_id,metadata");
    await deleteByIds(
        supa,
        "v2_model_provider_routes",
        "provider_model_id",
        existingRouteRows
            .filter(row => ["json", "models.dev"].includes(String(row.metadata?.source ?? "")))
            .filter(row => !desiredRouteIds.has(String(row.provider_model_id)))
            .filter(row => !excludedRouteIds.has(String(row.provider_model_id)))
            .map(row => String(row.provider_model_id)),
    );

    await upsertChunks(supa, "v2_route_capabilities", capabilities
        .filter(row => providerModels.some(route => String(route.provider_api_model_id) === String(row.provider_api_model_id)))
        .map(row => ({
            provider_model_id: row.provider_api_model_id,
            capability_id: row.capability_id,
            status: String(row.status ?? "").toLowerCase() === "active"
                ? "active"
                : String(row.status ?? "").toLowerCase() === "disabled"
                    ? "disabled"
                    : String(row.status ?? "").toLowerCase() === "internal_testing" ? "internal_testing" : "degraded",
            max_input_tokens: row.max_input_tokens ?? null,
            max_output_tokens: row.max_output_tokens ?? null,
            params: row.params ?? {},
            effective_from: null,
            effective_to: null,
            metadata: {
                source: "json",
                notes: row.notes ?? null,
                capability_evidence: source.providerModels.get(String(row.provider_api_model_id))?.capabilities?.find((capability: Record<string, any>) => capability.capability_id === row.capability_id) ?? null,
            },
        })), "provider_model_id,capability_id");

    const authoredAliasRows = aliases.filter(row => modelById.has(canonicalModelSlug(row.api_model_id))).map(row => ({
        alias_slug: row.alias_slug,
        model_slug: canonicalModelSlug(row.api_model_id),
        alias_type: row.channel ?? "public",
        enabled: row.is_enabled !== false,
        metadata: { source: "json", legacy_api_model_id: row.api_model_id, legacy_channel: row.channel ?? null },
    }));
    const freeVariantAliasRows = providerModels.flatMap(row => {
        if (!isFreeModelVariant(row.api_model_id)) return [];
        const modelSlug = v2RouteModelSlug(
            row,
            canonicalModelSlug,
            source.providerModels.get(String(row.provider_api_model_id)),
        );
        const aliasSlug = String(row.api_model_id ?? "").trim().toLowerCase();
        if (!aliasSlug || aliasSlug === modelSlug || !source.modelVariants.has(modelSlug)) return [];
        return [{
            alias_slug: aliasSlug,
            model_slug: modelSlug,
            alias_type: "provider",
            enabled: true,
            metadata: {
                source: "json",
                provider_model_id: row.provider_api_model_id,
                free_variant_alias: true,
            },
        }];
    });
    const v2AliasRows = new Map<string, Record<string, any>>();
    for (const row of [...authoredAliasRows, ...freeVariantAliasRows]) {
        v2AliasRows.set(String(row.alias_slug), row);
    }
    await upsertChunks(
        supa,
        "v2_model_aliases",
        [...v2AliasRows.values()],
        "alias_slug",
    );

    const routeByProviderModelId = new Map<string, Record<string, any>>();
    for (const row of providerModels) routeByProviderModelId.set(String(row.provider_api_model_id), row);
    const pricingRows: Record<string, any>[] = [];
    const unresolved: Record<string, any>[] = [];
    for (const rule of pricingRules) {
        const parsed = pricingModelPart(String(rule.model_key ?? ""));
        if (!parsed) continue;
        const providerModel = providerModelByApiKey.get(`${parsed.providerSlug}:${parsed.apiModelId}`);
        const route = providerModel ? routeByProviderModelId.get(String(providerModel.provider_api_model_id)) : null;
        if (!providerModel || !route || !modelById.has(String(route.model_id ?? route.internal_model_id ?? route.api_model_id))) {
            unresolved.push({ source_type: "pricing_rule", source_key: String(rule.rule_id), issue_code: "unresolved_provider_model", details: { model_key: rule.model_key } });
            continue;
        }
        const providerModelId = String(providerModel.provider_api_model_id);
        pricingRows.push({
            provider_model_id: providerModelId,
            sku_code: `legacy-${String(rule.rule_id).replaceAll("-", "")}`,
            version: 1,
            service_tier_slug: slug(rule.pricing_plan),
            operation: rule.capability_id ?? "inference",
            status: rule.effective_to && new Date(rule.effective_to) <= new Date() ? "deprecated" : "active",
            display_name: rule.tier_label || rule.meter || "meter",
            description: rule.note ?? null,
            currency: rule.currency ?? "USD",
            effective_from: rule.effective_from ?? "1970-01-01T00:00:00Z",
            effective_to: rule.effective_to && rule.effective_from && new Date(rule.effective_to) <= new Date(rule.effective_from) ? null : rule.effective_to ?? null,
            metadata: {
                source: "json",
                legacy_rule_id: rule.rule_id,
                legacy_model_key: rule.model_key,
                legacy_sku_id: rule.sku_id ?? null,
                match: rule.match ?? [],
                billing_timestamp_basis: rule.billing_timestamp_basis ?? "request_start",
                time_windows: rule.time_windows ?? [],
            },
        });
    }
    const tierSlugs = [...new Set(pricingRules.map(rule => slug(rule.pricing_plan)))];
    await upsertChunks(supa, "v2_service_tiers", tierSlugs.map(service_tier_slug => ({
        service_tier_slug,
        display_name: service_tier_slug.split(/[-_.:]+/g).filter(Boolean).map(part => part[0]?.toUpperCase() + part.slice(1)).join(" "),
        status: "active",
        metadata: { source: "json", legacy_pricing_plan: service_tier_slug },
    })), "service_tier_slug");

    await upsertChunks(supa, "v2_pricing_skus", pricingRows, "provider_model_id,sku_code,version");

    const routesForVariants = await fetchAll(supa, "v2_model_provider_routes", "provider_model_id,provider_slug,status,routing_enabled");
    const variantRows = routesForVariants.flatMap(route => {
        const regions = (providerRegionsByProvider.get(String(route.provider_slug)) ?? [])
            .filter(region => region !== "global");
        const sourceTiers = source.providerModels.get(String(route.provider_model_id))?.service_tiers;
        const routeTiers = Array.isArray(sourceTiers) && sourceTiers.length
            ? sourceTiers.map((tier: unknown) => slug(tier))
            : ["standard"];
        return routeTiers.flatMap(tier => {
            const global = [{
                provider_model_id: route.provider_model_id,
                variant_key: `global:${tier}`,
                service_tier_slug: tier,
                status: route.status,
                routing_enabled: Boolean(route.routing_enabled),
                endpoint_label: tier,
                metadata: { source: "json", scope: "global" },
            }];
            const regional = regions.map(region => ({
                provider_model_id: route.provider_model_id,
                variant_key: `region:${region}:${tier}`,
                execution_region: region,
                service_tier_slug: tier,
                status: route.status,
                routing_enabled: Boolean(route.routing_enabled),
                endpoint_label: `${region.toUpperCase()} ${tier}`,
                metadata: { source: "json", scope: "regional" },
            }));
            return [...global, ...regional];
        });
    });
    await upsertChunks(supa, "v2_route_variants", variantRows, "provider_model_id,variant_key");
    const desiredVariantKeys = new Set(
        variantRows.map(row => `${String(row.provider_model_id)}:${String(row.variant_key)}`),
    );
    const existingVariantRows = await fetchAll(
        supa,
        "v2_route_variants",
        "variant_id,provider_model_id,variant_key,metadata",
    );
    await deleteByIds(
        supa,
        "v2_route_variants",
        "variant_id",
        existingVariantRows
            .filter(row => ["json", "models.dev", "v2_provider_regions"].includes(String(row.metadata?.source ?? "")))
            .filter(row => !desiredVariantKeys.has(`${String(row.provider_model_id)}:${String(row.variant_key)}`))
            .map(row => String(row.variant_id)),
    );
    assertOk(
        await supa.rpc("refresh_v2_pricing_variant_links"),
        "v2 sync refresh pricing variant links",
    );

    const skuRows = await fetchAll(supa, "v2_pricing_skus", "sku_id,provider_model_id,sku_code,version");
    const skuByCode = new Map(skuRows.map(row => [`${row.provider_model_id}:${row.sku_code}:${row.version}`, row.sku_id]));
    const meterRows = pricingRules.flatMap(rule => {
        const parsed = pricingModelPart(String(rule.model_key ?? ""));
        const providerModel = parsed ? providerModelByApiKey.get(`${parsed.providerSlug}:${parsed.apiModelId}`) : null;
        const skuId = providerModel ? skuByCode.get(`${providerModel.provider_api_model_id}:legacy-${String(rule.rule_id).replaceAll("-", "")}:1`) : null;
        if (!skuId) return [];
        const meter = String(rule.meter ?? "meter");
        const lowerMeter = meter.toLowerCase();
        return [{
            sku_id: skuId,
            meter_key: lowerMeter.replace(/[^a-z0-9._:-]+/g, "_"),
            modality: lowerMeter.includes("audio") ? "audio" : lowerMeter.includes("image") || lowerMeter.includes("pixel") ? "image" : lowerMeter.includes("video") || lowerMeter.includes("second") ? "video" : lowerMeter.includes("embedding") ? "embedding" : lowerMeter.includes("rerank") ? "rerank" : "text",
            direction: lowerMeter.startsWith("input_") || lowerMeter.startsWith("cached_") ? "input" : lowerMeter.startsWith("output_") ? "output" : null,
            unit: rule.unit ?? "unit",
            unit_quantity: rule.unit_size ?? 1,
            price_nanos: Number(rule.price_per_unit ?? 0) * 1_000_000_000,
            display_label: meter,
            display_unit: `${rule.unit_size ?? 1} ${rule.unit ?? "unit"}`,
            metadata: {
                source: "json",
                legacy_rule_id: rule.rule_id,
                priority: rule.priority ?? 100,
                billing_timestamp_basis: rule.billing_timestamp_basis ?? "request_start",
                time_windows: rule.time_windows ?? [],
            },
        }];
    });
    await upsertChunks(supa, "v2_pricing_sku_meters", meterRows, "sku_id,meter_key");

    if (unresolved.length) {
        await upsertChunks(supa, "v2_catalogue_backfill_issues", unresolved, "source_type,source_key,issue_code");
    }

    await upsertChunks(supa, "v2_benchmarks", benchmarkRows, "benchmark_id");

    await upsertChunks(supa, "v2_benchmark_results", benchmarkPreflight.rows, "result_id");

    const preflightIssues = [...modelPreflight.issues, ...benchmarkPreflight.issues];
    if (benchmarkPreflight.issues.length) {
        await upsertChunks(supa, "v2_catalogue_backfill_issues", benchmarkPreflight.issues, "source_type,source_key,issue_code");
    }
    console.log(`[v2-sync] models=${canonicalModels.length + variantModelRows.length} base_models=${canonicalModels.length} variant_models=${variantModelRows.length} legacy_models=${models.length} routes=${providerModels.length} pricing_rules=${pricingRules.length} pricing_skus=${pricingRows.length} benchmarks=${benchmarkRows.length} benchmark_results=${benchmarkPreflight.rows.length} preflight_issues=${preflightIssues.length} unresolved_pricing=${unresolved.length}`);
}
