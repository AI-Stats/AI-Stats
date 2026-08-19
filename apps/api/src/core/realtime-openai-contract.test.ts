import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRealtimeSessionSchema } from "@/routes/v1/data/realtime-sessions";

type CatalogEntry = {
	provider_api_model_id: string;
	provider_model_slug: string;
	internal_model_id: string;
	is_active_gateway: boolean;
	input_modalities: string | null;
	output_modalities: string | null;
	context_length: number | null;
	max_output_tokens: number | null;
	capabilities: Array<{ capability_id: string }>;
};

function providerModels(provider: "openai" | "openai-eu"): CatalogEntry[] {
	const path = fileURLToPath(new URL(
		`../../../../packages/data/catalog/src/data/api_providers/${provider}/models.json`,
		import.meta.url,
	));
	return JSON.parse(readFileSync(path, "utf8")) as CatalogEntry[];
}

describe("OpenAI Realtime contract", () => {
	it("rejects unsupported session types instead of silently creating a voice-agent session", () => {
		expect(createRealtimeSessionSchema.safeParse({
			type: "realtime",
			model: "openai/gpt-realtime-2",
			voice: "marin",
		}).success).toBe(true);
		expect(createRealtimeSessionSchema.safeParse({
			type: "transcription",
			model: "openai/gpt-live-transcribe",
		}).success).toBe(false);
		expect(createRealtimeSessionSchema.safeParse({
			type: "translation",
			model: "openai/gpt-realtime-translate",
		}).success).toBe(false);
		expect(createRealtimeSessionSchema.safeParse({
			type: "realtime",
			model: "openai/gpt-realtime-2",
			audio: { output: { voice: "marin" } },
		}).success).toBe(false);
	});

	it.each(["openai", "openai-eu"] as const)(
		"classifies %s live Realtime models by their actual modality",
		(provider) => {
			const entries = providerModels(provider);
			const expected: Record<string, Partial<CatalogEntry>> = {
				"openai/gpt-live-transcribe": {
					input_modalities: "text,audio",
					output_modalities: "text",
				},
				"openai/gpt-realtime": {
					input_modalities: "text,image,audio",
					output_modalities: "text,audio",
					context_length: 32000,
					max_output_tokens: 4096,
				},
				"openai/gpt-realtime-2.1": {
					input_modalities: "text,image,audio",
					output_modalities: "text,audio",
					context_length: 128000,
					max_output_tokens: 32000,
				},
				"openai/gpt-realtime-2.1-mini": {
					input_modalities: "text,image,audio",
					output_modalities: "text,audio",
					context_length: 128000,
					max_output_tokens: 32000,
				},
				"openai/gpt-realtime-mini": {
					input_modalities: "text,image,audio",
					output_modalities: "text,audio",
					context_length: 32000,
					max_output_tokens: 4096,
				},
				"openai/gpt-realtime-translate": {
					input_modalities: "audio",
					output_modalities: "text,audio",
					context_length: 16000,
					max_output_tokens: 2000,
				},
				"openai/gpt-realtime-whisper": {
					input_modalities: "text,audio",
					output_modalities: "text",
					context_length: 16000,
					max_output_tokens: 2000,
				},
			};

			for (const [model, contract] of Object.entries(expected)) {
				const matches = entries.filter((entry) => entry.internal_model_id === model);
				expect(matches.length, `${provider}:${model}`).toBeGreaterThan(0);
				for (const entry of matches) {
					expect(entry).toMatchObject(contract);
					expect(entry.capabilities.map((capability) => capability.capability_id)).toContain("audio.realtime");
				}
			}
		},
	);

	it("routes the active gpt-realtime alias instead of its deprecated snapshot", () => {
		const active = providerModels("openai").find((entry) =>
			entry.provider_api_model_id === "openai:openai/gpt-realtime" && entry.is_active_gateway);
		expect(active?.provider_model_slug).toBe("gpt-realtime");
	});
});
