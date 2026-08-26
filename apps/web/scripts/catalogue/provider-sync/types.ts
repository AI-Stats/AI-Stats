import type { JsonObject } from "../catalogue-sync-shared";

export type ProviderSyncModel = {
	id: string;
	details: JsonObject;
};

export type ProviderSyncProvider = {
	id: string;
	name: string;
	sourceUrl: string;
	apiKeyEnv?: string;
	fetchModels(fetcher?: typeof fetch): Promise<unknown>;
	parseModels(raw: unknown): ProviderSyncModel[];
};
