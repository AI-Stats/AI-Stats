import fs from 'node:fs';
import path from 'node:path';

type JsonObject = Record<string, any>;

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'packages', 'data', 'catalog', 'src', 'data');
const MANIFEST_PATH = path.join(DATA_ROOT, 'manifest.json');
const MODELS_DIR = path.join(DATA_ROOT, 'models');
const API_PROVIDERS_DIR = path.join(DATA_ROOT, 'api_providers');

function readJson(filePath: string): JsonObject | JsonObject[] {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonObject | JsonObject[];
}

function nonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function listJsonFiles(root: string, filename: string): string[] {
    if (!fs.existsSync(root)) return [];
    const files: string[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...listJsonFiles(entryPath, filename));
        } else if (entry.isFile() && entry.name === filename) {
            files.push(entryPath);
        }
    }
    return files;
}

function parseDate(value: unknown): number | null {
    const raw = nonEmptyString(value);
    if (!raw) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(raw) ? `${raw}Z` : raw;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function isEffectiveNow(row: JsonObject, now: number): boolean {
    const from = parseDate(row.effective_from);
    const to = parseDate(row.effective_to);
    if (from !== null && now < from) return false;
    if (to !== null && now >= to) return false;
    return true;
}

type ModelRecord = {
    modelId: string;
    organisationId: string;
};

type ManifestDrift = {
    missingModelIds: string[];
    missingOrganisationIds: string[];
    unresolvedActiveRoutes: string[];
};

function loadModels(): Map<string, ModelRecord> {
    const models = new Map<string, ModelRecord>();
    for (const filePath of listJsonFiles(MODELS_DIR, 'model.json')) {
        const model = readJson(filePath) as JsonObject;
        const modelId = nonEmptyString(model.model_id);
        const organisationId = nonEmptyString(model.organisation_id);
        if (modelId && organisationId) models.set(modelId, { modelId, organisationId });
    }
    return models;
}

function loadActiveCanonicalModelIds(models: Map<string, ModelRecord>): {
    modelIds: Set<string>;
    unresolved: string[];
} {
    const modelIds = new Set<string>();
    const unresolved = new Set<string>();
    const now = Date.now();

    for (const filePath of listJsonFiles(API_PROVIDERS_DIR, 'models.json')) {
        const rows = readJson(filePath);
        if (!Array.isArray(rows)) continue;

        for (const row of rows) {
            if (row?.is_active_gateway !== true || !isEffectiveNow(row, now)) continue;

            const apiModelId = nonEmptyString(row.api_model_id);
            const internalModelId = nonEmptyString(row.internal_model_id);
            const routeId = internalModelId ?? apiModelId;
            if (!routeId) continue;

            const model = (internalModelId ? models.get(internalModelId) : undefined) ??
                (apiModelId ? models.get(apiModelId) : undefined);
            if (!model) {
                unresolved.add(`${path.basename(path.dirname(filePath))}:${routeId}`);
                continue;
            }
            modelIds.add(model.modelId);
        }
    }

    return { modelIds, unresolved: [...unresolved].sort((a, b) => a.localeCompare(b)) };
}

function manifestModelIds(manifest: JsonObject): Set<string> {
    const ids = new Set<string>();
    const groups = manifest.models && typeof manifest.models === 'object' ? manifest.models : {};
    for (const values of Object.values(groups)) {
        if (!Array.isArray(values)) continue;
        for (const value of values) {
            const id = nonEmptyString(value);
            if (id) ids.add(id);
        }
    }
    return ids;
}

function manifestOrganisationIds(manifest: JsonObject): Set<string> {
    return new Set(
        Array.isArray(manifest.organisations)
            ? manifest.organisations.map(nonEmptyString).filter((value): value is string => value !== null)
            : []
    );
}

function getDrift(manifest: JsonObject, models: Map<string, ModelRecord>): ManifestDrift {
    const active = loadActiveCanonicalModelIds(models);
    const indexedModels = manifestModelIds(manifest);
    const indexedOrganisations = manifestOrganisationIds(manifest);
    const missingModelIds = [...active.modelIds]
        .filter((modelId) => !indexedModels.has(modelId))
        .sort((a, b) => a.localeCompare(b));
    const missingOrganisationIds = [...new Set(
        missingModelIds
            .map((modelId) => models.get(modelId)?.organisationId)
            .filter((value): value is string => Boolean(value))
    )]
        .filter((organisationId) => !indexedOrganisations.has(organisationId))
        .sort((a, b) => a.localeCompare(b));

    return {
        missingModelIds,
        missingOrganisationIds,
        unresolvedActiveRoutes: active.unresolved,
    };
}

function syncManifest(manifest: JsonObject, models: Map<string, ModelRecord>, drift: ManifestDrift): void {
    if (!manifest.models || typeof manifest.models !== 'object' || Array.isArray(manifest.models)) {
        manifest.models = {};
    }
    if (!Array.isArray(manifest.organisations)) manifest.organisations = [];

    const groups = manifest.models as Record<string, unknown>;
    const additionsByOrganisation = new Map<string, string[]>();
    for (const modelId of drift.missingModelIds) {
        const organisationId = models.get(modelId)?.organisationId ?? modelId.split('/', 1)[0];
        const additions = additionsByOrganisation.get(organisationId) ?? [];
        additions.push(modelId);
        additionsByOrganisation.set(organisationId, additions);
    }

    for (const [organisationId, modelIds] of additionsByOrganisation) {
        const existing = Array.isArray(groups[organisationId]) ? groups[organisationId] as unknown[] : [];
        const existingIds = new Set(existing.map(nonEmptyString).filter((value): value is string => value !== null));
        for (const modelId of modelIds.sort((a, b) => a.localeCompare(b))) {
            if (!existingIds.has(modelId)) existing.push(modelId);
        }
        groups[organisationId] = existing;
    }

    const existingOrganisations = new Set(
        manifest.organisations.map(nonEmptyString).filter((value): value is string => value !== null)
    );
    for (const organisationId of drift.missingOrganisationIds) {
        if (!existingOrganisations.has(organisationId)) manifest.organisations.push(organisationId);
    }
}

function formatJsonPreservingLineEndings(filePath: string, value: JsonObject): string {
    const existing = fs.readFileSync(filePath, 'utf8');
    const newline = existing.includes('\r\n') ? '\r\n' : '\n';
    return `${JSON.stringify(value, null, 2).replaceAll('\n', newline)}${newline}`;
}

function main(): void {
    const checkOnly = process.argv.includes('--check');
    const manifest = readJson(MANIFEST_PATH) as JsonObject;
    const models = loadModels();
    const drift = getDrift(manifest, models);

    if (drift.unresolvedActiveRoutes.length > 0) {
        throw new Error(
            `Active gateway routes do not resolve to canonical model files:\n${drift.unresolvedActiveRoutes.join('\n')}`
        );
    }

    if (drift.missingModelIds.length === 0 && drift.missingOrganisationIds.length === 0) {
        console.log('Catalog manifest is in sync with active gateway model routes.');
        return;
    }

    if (checkOnly) {
        console.error(`Catalog manifest is missing ${drift.missingModelIds.length} active model IDs.`);
        if (drift.missingModelIds.length > 0) console.error(drift.missingModelIds.join('\n'));
        if (drift.missingOrganisationIds.length > 0) {
            console.error(`Catalog manifest is missing ${drift.missingOrganisationIds.length} organisations.`);
            console.error(drift.missingOrganisationIds.join('\n'));
        }
        process.exitCode = 1;
        return;
    }

    syncManifest(manifest, models, drift);
    fs.writeFileSync(MANIFEST_PATH, formatJsonPreservingLineEndings(MANIFEST_PATH, manifest), 'utf8');
    console.log(`Added ${drift.missingModelIds.length} active model IDs to the catalog manifest.`);
    if (drift.missingOrganisationIds.length > 0) {
        console.log(`Added ${drift.missingOrganisationIds.length} organisations to the catalog manifest.`);
    }
}

main();
