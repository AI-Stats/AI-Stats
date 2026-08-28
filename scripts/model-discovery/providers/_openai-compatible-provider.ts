import { asArray, asRecord, defineProvider, fetchJson, getMissingEnvVars, normalizeModelEntries } from "./_shared";

type OpenAICompatProviderConfig = {
    providerId: string;
    name: string;
    apiKeyEnv: string | string[];
    baseUrl?: string;
    baseUrlEnv?: string;
    pathPrefix?: string;
    apiKeyHeader?: string;
    apiKeyPrefix?: string;
    providerAttribution?: string;
    additionalModelPaths?: string[];
};

function normalizePathSegment(value?: string): string {
    if (!value) return "";
    return "/" + value.replace(/^\/+|\/+$/g, "");
}

function normalizeModelsUrl(baseUrl: string, pathPrefix?: string, modelPath = "/models"): string {
    const base = baseUrl.replace(/\/+$/, "");
    let prefix = normalizePathSegment(pathPrefix);

    if (prefix) {
        try {
            const parsed = new URL(base);
            const basePath = parsed.pathname.replace(/\/+$/, "");
            if (basePath === prefix || basePath.endsWith(prefix)) {
                prefix = "";
            }
        } catch {
            // Ignore parse errors and use default behavior.
        }
    }

    const suffix = normalizePathSegment(modelPath);
    return prefix ? base + prefix + suffix : base + suffix;
}

export function defineOpenAICompatibleProvider(config: OpenAICompatProviderConfig) {
    const apiKeyEnvCandidates = Array.isArray(config.apiKeyEnv)
        ? config.apiKeyEnv
        : [config.apiKeyEnv];
    const primaryApiKeyEnv = apiKeyEnvCandidates[0];
    const configuredApiKeyEnv =
        apiKeyEnvCandidates.find((envName) => getMissingEnvVars([envName]).length === 0) ??
        primaryApiKeyEnv;

    return defineProvider({
        id: config.providerId,
        name: config.name,
        requiredEnv:
            config.baseUrlEnv && !config.baseUrl
                ? [configuredApiKeyEnv, config.baseUrlEnv]
                : [configuredApiKeyEnv],
        async fetchModels() {
            const apiKeyEnv = apiKeyEnvCandidates.find(
                (envName) => getMissingEnvVars([envName]).length === 0
            );
            const key = apiKeyEnv ? process.env[apiKeyEnv] : undefined;
            const configuredBaseUrl = config.baseUrlEnv ? process.env[config.baseUrlEnv] : undefined;
            const baseUrl = config.baseUrl ?? configuredBaseUrl;

            if (!key) {
                throw new Error("Missing API key: " + apiKeyEnvCandidates.join(" | "));
            }
            if (!baseUrl) {
                throw new Error("Missing base URL for " + config.providerId);
            }

            const modelPaths = ["/models", ...(config.additionalModelPaths ?? [])];
            const payloads = await Promise.all(modelPaths.map((modelPath) =>
                fetchJson({
                    url: normalizeModelsUrl(baseUrl, config.pathPrefix, modelPath),
                    init: {
                        headers: {
                            [config.apiKeyHeader ?? "Authorization"]: (config.apiKeyPrefix ?? "Bearer ") + key,
                        },
                    },
                })
            ));

            const models = payloads.flatMap((payload) => Array.isArray(payload)
                ? payload
                : asArray(asRecord(payload)?.data).length
                    ? asArray(asRecord(payload)?.data)
                    : asArray(asRecord(payload)?.models)
            ).filter((model) => {
                if (!config.providerAttribution) return true;
                const providers = asArray(asRecord(model)?.providers)
                    .filter((provider): provider is string => typeof provider === "string");
                return providers.length === 0 || providers.includes(config.providerAttribution);
            });

            return normalizeModelEntries(models, (item) => (typeof item.id === "string" ? item.id : null));
        },
    });
}
