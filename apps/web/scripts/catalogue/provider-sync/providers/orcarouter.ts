import { defineProvider, parseProviderModelList } from "../provider";

export const provider = defineProvider({
	id: "orcarouter",
	name: "OrcaRouter",
	sourceUrl: "https://api.orcarouter.ai/v1/models",
	apiKeyEnv: "ORCAROUTER_API_KEY",
	parseModels(raw) {
		return parseProviderModelList(raw).map((model) => {
			const endpoints = Array.isArray(model.details.supported_endpoint_types)
				? model.details.supported_endpoint_types.map(String)
				: [];
			const details = { ...model.details };
			const architecture = details.architecture && typeof details.architecture === "object"
				? details.architecture as { output_modalities?: unknown }
				: null;
			const outputs = Array.isArray(architecture?.output_modalities)
				? architecture.output_modalities.map(String)
				: [];
			if (endpoints.includes("openai-video") || outputs.includes("video")) details.type = "video";
			else if (endpoints.includes("openai-image") || endpoints.includes("image-generation") || outputs.includes("image")) details.type = "image";
			else if (endpoints.includes("openai-audio") || outputs.includes("audio") || /(?:^|[-/])tts(?:-|$)/.test(model.id)) details.type = "speech";
			return { ...model, details };
		});
	},
});
