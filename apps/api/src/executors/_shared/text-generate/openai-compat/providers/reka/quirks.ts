// Reka Chat is OpenAI-shaped but uses provider-specific multimodal and tool-choice fields.
// https://docs.reka.ai/chat/api-reference/create

import type { ProviderQuirks } from "../../quirks/types";

export const rekaQuirks: ProviderQuirks = {
	transformRequest: ({ request }) => {
		if (request.tool_choice === "required") request.tool_choice = "tool";
		if (!Array.isArray(request.messages)) return;
		request.messages = request.messages.map((message: any) => {
			if (!Array.isArray(message?.content)) return message;
			return {
				...message,
				content: message.content.map((part: any) => {
					if (part?.type === "video_url" || part?.type === "input_video") {
						return {
							...part,
							type: "video_url",
							video_url: typeof part.video_url === "string"
								? part.video_url
								: part.video_url?.url,
						};
					}
					if (part?.type === "input_audio") {
						const url = part.input_audio?.url;
						if (typeof url === "string") return { type: "audio_url", audio_url: url };
					}
					return part;
				}),
			};
		});
	},
};
