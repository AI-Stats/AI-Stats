// Purpose: Provider adapter module.
// Why: Encapsulates provider-specific configuration and endpoint mapping.
// How: Exposes provider-specific helpers for routing and execution.

import { getBindings } from "@/runtime/env";
import type { ProviderExecuteArgs } from "../types";
import { resolveProviderKey, type ResolvedKey } from "../keys";

function azureConfigError(code: string): Error & { code: string } {
    const error = new Error(code) as Error & { code: string };
    error.code = code;
    return error;
}

export type AzureOpenAIConfig = {
    baseUrl: string;
    apiVersion: string;
};

export function resolveAzureConfig(): AzureOpenAIConfig {
    const bindings = getBindings();
    const baseUrl = bindings.AZURE_OPENAI_BASE_URL;
    if (!baseUrl) {
        throw azureConfigError("azure_base_url_missing");
    }
    const configuredApiVersion = bindings.AZURE_OPENAI_API_VERSION?.trim();
    return {
        baseUrl,
        apiVersion: configuredApiVersion || "v1",
    };
}

export function resolveAzureKey(args: ProviderExecuteArgs): ResolvedKey {
    return resolveProviderKey(args, () => getBindings().AZURE_OPENAI_API_KEY);
}

export type AzureCredential = ResolvedKey & { authType: "api-key" | "entra" };

export function resolveAzureCredential(args: ProviderExecuteArgs): AzureCredential {
	const apiKey = resolveProviderKey(args, () => getBindings().AZURE_OPENAI_API_KEY, { allowEmptyFallback: true });
	if (apiKey.key) return { ...apiKey, authType: "api-key" };
	const token = getBindings().AZURE_OPENAI_AUTH_TOKEN?.trim();
	if (token) return { key: token, source: "gateway", byokId: null, authType: "entra" };
	return { ...resolveAzureKey(args), authType: "api-key" };
}

export function azureHeaders(key: string, authType: "api-key" | "entra" = "api-key"): Record<string, string> {
    return {
		...(authType === "entra" ? { Authorization: `Bearer ${key}` } : { "api-key": key }),
        "Content-Type": "application/json",
    };
}

export function azureDeployment(args: ProviderExecuteArgs): string {
    return encodeURIComponent(args.providerModelSlug || args.model);
}

function azureResourceBaseUrl(baseUrl: string): string {
    return baseUrl
        .replace(/\/+$/, "")
        .replace(/\/openai\/v1$/i, "")
        .replace(/\/openai$/i, "");
}

export function azureUrl(path: string, apiVersion: string, baseUrl?: string): string {
    const base = azureResourceBaseUrl(baseUrl ?? resolveAzureConfig().baseUrl);
    const trimmedPath = path.replace(/^\/+/, "");
    return `${base}/${trimmedPath}?api-version=${encodeURIComponent(apiVersion)}`;
}

export function azureOpenAIV1Url(path: string, baseUrl?: string, apiVersion = "v1"): string {
    const base = azureResourceBaseUrl(baseUrl ?? resolveAzureConfig().baseUrl);
    const trimmedPath = path.replace(/^\/+/, "");
	const url = `${base}/openai/v1/${trimmedPath}`;
	return apiVersion.trim().toLowerCase() === "preview" ? `${url}?api-version=preview` : url;
}

export function usesAzureV1(apiVersion: string): boolean {
	const normalized = apiVersion.trim().toLowerCase();
	return normalized === "v1" || normalized === "preview";
}
