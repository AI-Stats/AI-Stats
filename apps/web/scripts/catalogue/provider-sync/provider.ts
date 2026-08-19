import type { JsonObject } from "../catalogue-sync-shared";
import type { ProviderSyncModel, ProviderSyncProvider } from "./types";

function asRecord(value: unknown): JsonObject | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

export function parseProviderModelList(raw: unknown): ProviderSyncModel[] {
	const body = asRecord(raw);
	const values = Array.isArray(raw)
		? raw
		: Array.isArray(body?.data)
			? body.data
			: Array.isArray(body?.models)
				? body.models
				: [];

	return values.flatMap((value): ProviderSyncModel[] => {
		const details = asRecord(value);
		if (!details) return [];
		const id = details.id ?? details.model_id ?? details.name;
		return typeof id === "string" && id.trim()
			? [{ id: id.trim(), details }]
			: [];
	});
}

type ProviderDefinition = {
	id: string;
	name: string;
	sourceUrl: string;
	apiKeyEnv?: string;
	parseModels?: (raw: unknown) => ProviderSyncModel[];
};

export function defineProvider(definition: ProviderDefinition): ProviderSyncProvider {
	return {
		id: definition.id,
		name: definition.name,
		sourceUrl: definition.sourceUrl,
		apiKeyEnv: definition.apiKeyEnv,
		async fetchModels(fetcher = fetch): Promise<unknown> {
			const apiKey = definition.apiKeyEnv ? process.env[definition.apiKeyEnv]?.trim() : undefined;
			const headers: Record<string, string> = { accept: "application/json" };
			if (apiKey) headers.authorization = `Bearer ${apiKey}`;
			const response = await fetcher(definition.sourceUrl, {
				headers,
				signal: AbortSignal.timeout(30_000),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return response.json();
		},
		parseModels: definition.parseModels ?? parseProviderModelList,
	};
}
