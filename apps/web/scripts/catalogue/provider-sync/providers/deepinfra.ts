import type { JsonObject } from "../../catalogue-sync-shared";
import type { ProviderSyncModel, ProviderSyncProvider } from "../types";

const CURRENT_MODELS_URL = "https://api.deepinfra.com/v1/openai/models";
const MODEL_DETAILS_URL = "https://api.deepinfra.com/models/list";

function asRecord(value: unknown): JsonObject | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function modelType(value: unknown): string {
	switch (value) {
		case "embeddings": return "embedding";
		case "text-to-image": return "image";
		case "text-to-video":
		case "world-model": return "video";
		case "text-to-speech":
		case "text-to-music": return "speech";
		case "automatic-speech-recognition": return "transcription";
		case "reranker": return "reranking";
		default: return "text";
	}
}

function tokenPricing(value: unknown): JsonObject | null {
	const pricing = asRecord(value);
	if (!pricing || pricing.type !== "tokens") return null;
	const input = Number(pricing.cents_per_input_token) * 10_000;
	const output = Number(pricing.cents_per_output_token) * 10_000;
	const cacheRate = pricing.rate_per_input_token_cached == null
		? null
		: Number(pricing.rate_per_input_token_cached);
	return {
		...(Number.isFinite(input) ? { input_tokens: input } : {}),
		...(Number.isFinite(output) ? { output_tokens: output } : {}),
		...(cacheRate !== null && Number.isFinite(input * cacheRate) ? { cache_read_tokens: input * cacheRate } : {}),
	};
}

export const provider: ProviderSyncProvider = {
	id: "deepinfra",
	name: "DeepInfra",
	sourceUrl: MODEL_DETAILS_URL,
	async fetchModels(fetcher = fetch): Promise<unknown> {
		const [currentResponse, detailsResponse] = await Promise.all([
			fetcher(CURRENT_MODELS_URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) }),
			fetcher(MODEL_DETAILS_URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) }),
		]);
		if (!currentResponse.ok) throw new Error(`Current models HTTP ${currentResponse.status}`);
		if (!detailsResponse.ok) throw new Error(`Model details HTTP ${detailsResponse.status}`);
		return { current: await currentResponse.json(), details: await detailsResponse.json() };
	},
	parseModels(raw: unknown): ProviderSyncModel[] {
		const payload = asRecord(raw);
		const current = asRecord(payload?.current);
		const currentIds = new Set((Array.isArray(current?.data) ? current.data : []).flatMap((value) => {
			const id = asRecord(value)?.id;
			return typeof id === "string" ? [id] : [];
		}));
		const details = Array.isArray(payload?.details) ? payload.details : [];
		const detailsById = new Map(details.flatMap((value): Array<[string, JsonObject]> => {
			const record = asRecord(value);
			return record && typeof record.model_name === "string" ? [[record.model_name, record]] : [];
		}));
		return [...currentIds].map((id) => {
			const detail = detailsById.get(id) ?? {};
			return {
				id,
				details: {
					...detail,
					id,
					type: modelType(detail.reported_type),
					context_length: detail.max_tokens ?? null,
					max_output_tokens: detail.max_output_tokens ?? null,
					metadata: { pricing: tokenPricing(detail.pricing) ?? {} },
				},
			};
		});
	},
};
