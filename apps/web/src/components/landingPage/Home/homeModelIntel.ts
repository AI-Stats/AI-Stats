import type { GatewaySupportedModel } from "@/lib/fetchers/gateway/getGatewaySupportedModelIds";

export type LandingOpenModelIntelEntry = {
	providerId: string;
	name: string;
	model: string;
	latencyMs: number;
	throughputTps: number;
};

export type HomeModelPrice = {
	inputPrice: number;
	outputPrice: number;
};

export type HomeModelPrices = Record<string, HomeModelPrice>;

export const BETA_OPEN_MODEL_INTEL: LandingOpenModelIntelEntry[] = [
	{
		providerId: "openai",
		name: "GPT-5.6 Sol",
		model: "openai/gpt-5.6-sol",
		latencyMs: 472,
		throughputTps: 92,
	},
	{
		providerId: "anthropic",
		name: "Claude Fable 5",
		model: "anthropic/claude-fable-5",
		latencyMs: 548,
		throughputTps: 79,
	},
	{
		providerId: "google",
		name: "Gemini 3.1 Pro",
		model: "google/gemini-3.1-pro-preview",
		latencyMs: 441,
		throughputTps: 101,
	},
	{
		providerId: "minimax",
		name: "MiniMax M3",
		model: "minimax/minimax-m3",
		latencyMs: 388,
		throughputTps: 108,
	},
	{
		providerId: "deepseek",
		name: "DeepSeek V4 Pro",
		model: "deepseek/deepseek-v4-pro",
		latencyMs: 405,
		throughputTps: 94,
	},
	{
		providerId: "moonshotai",
		name: "Kimi K2.7 Code",
		model: "moonshotai/kimi-k2.7-code",
		latencyMs: 423,
		throughputTps: 89,
	},
];

const HOME_MODEL_IDS = new Set(BETA_OPEN_MODEL_INTEL.map((entry) => entry.model));

export function buildHomeModelPrices(
	models: GatewaySupportedModel[],
): HomeModelPrices {
	const prices: HomeModelPrices = {};

	for (const model of models) {
		if (!model.isAvailable || !HOME_MODEL_IDS.has(model.modelId)) continue;

		const inputPrice = model.inputPricePerMillion;
		const outputPrice = model.outputPricePerMillion;
		if (
			typeof inputPrice !== "number" ||
			!Number.isFinite(inputPrice) ||
			inputPrice < 0 ||
			typeof outputPrice !== "number" ||
			!Number.isFinite(outputPrice) ||
			outputPrice < 0
		) {
			continue;
		}

		const current = prices[model.modelId];
		if (
			!current ||
			inputPrice < current.inputPrice ||
			(inputPrice === current.inputPrice && outputPrice < current.outputPrice)
		) {
			prices[model.modelId] = { inputPrice, outputPrice };
		}
	}

	return prices;
}
