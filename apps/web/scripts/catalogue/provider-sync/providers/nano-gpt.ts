import { parseProviderModelList } from "../provider";
import type { ProviderSyncProvider } from "../types";

const MODEL_FEEDS = [
	["https://nano-gpt.com/api/v1/models?detailed=true", undefined],
	["https://nano-gpt.com/api/v1/image-models", "image"],
	["https://nano-gpt.com/api/v1/video-models", "video"],
	["https://nano-gpt.com/api/v1/audio-models", "speech"],
	["https://nano-gpt.com/api/v1/embedding-models", "embedding"],
] as const;

export const provider: ProviderSyncProvider = {
	id: "nano-gpt",
	name: "NanoGPT",
	sourceUrl: "https://docs.nano-gpt.com/introduction",
	async fetchModels(fetcher = fetch): Promise<unknown> {
		const payloads = await Promise.all(MODEL_FEEDS.map(async ([url, type]) => {
			const response = await fetcher(url, {
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(30_000),
			});
			if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
			return parseProviderModelList(await response.json()).map(({ details }) => ({
				...details,
				...(type && details.type == null ? { type } : {}),
			}));
		}));
		return { data: payloads.flat() };
	},
	parseModels: parseProviderModelList,
};
