// Purpose: Adapt shared OpenAI chat payloads to Chutes' documented multimodal and template controls.
// Why: Chutes accepts audio_url/video_url parts and exposes model-specific thinking switches.
// How: Rewrites only those provider-specific fields while retaining the standard Chat shape.

import type { ProviderQuirks } from "../../quirks/types";

function isRecord(value: unknown): value is Record<string, any> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function audioDataUrl(data: string, format: string): string {
	const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
	return `data:${mime};base64,${data}`;
}

export const chutesQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir, model }) => {
		const raw = isRecord(ir.rawRequest) ? ir.rawRequest : {};
		const rawTemplate = isRecord(raw.chat_template_kwargs)
			? { ...raw.chat_template_kwargs }
			: {};
		const modelName = String(model ?? request.model ?? ir.model ?? "").toLowerCase();
		const reasoningEnabled = ir.reasoning?.enabled ?? (
			ir.reasoning?.effort !== undefined ? ir.reasoning.effort !== "none" : undefined
		);
		if (reasoningEnabled !== undefined) {
			if (modelName.includes("kimi")) rawTemplate.thinking ??= reasoningEnabled;
			if (modelName.includes("nemotron")) rawTemplate.enable_thinking ??= reasoningEnabled;
		}
		if (Object.keys(rawTemplate).length > 0) request.chat_template_kwargs = rawTemplate;

		if (!Array.isArray(request.messages)) return;
		request.messages = request.messages.map((message: any) => {
			if (!Array.isArray(message?.content)) return message;
			return {
				...message,
				content: message.content.map((part: any) => {
					if (part?.type === "input_video" && isRecord(part.video_url)) {
						return { ...part, type: "video_url" };
					}
					if (part?.type !== "input_audio" || !isRecord(part.input_audio)) return part;
					const audio = part.input_audio;
					const url = typeof audio.url === "string"
						? audio.url
						: typeof audio.data === "string"
							? audioDataUrl(audio.data, typeof audio.format === "string" ? audio.format : "wav")
							: undefined;
					if (!url) return part;
					return { type: "audio_url", audio_url: { url } };
				}),
			};
		});
	},
};
