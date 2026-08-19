import { describe, expect, it } from "vitest";
import { resolveProviderExecutor } from "../index";

const REQUIRED_MODALITY_CAPABILITIES = [
	"text.generate",
	"images.generations",
	"audio.speech",
	"video.generation",
] as const;

const PRIORITY_PROVIDERS = [
	"openai",
	"x-ai",
	"minimax",
	"google-ai-studio",
] as const;

const PRIORITY_PROVIDER_ALIASES = [
	"xai",
] as const;

describe("priority provider multimodal coverage", () => {
	it("resolves text/image/audio/video executors for each priority provider", () => {
		for (const provider of PRIORITY_PROVIDERS) {
			for (const capability of REQUIRED_MODALITY_CAPABILITIES) {
				expect(
					resolveProviderExecutor(provider, capability),
					`${provider} should resolve ${capability}`,
				).toBeTruthy();
			}
		}
	});

	it("keeps key provider aliases on full multimodal coverage", () => {
		for (const provider of PRIORITY_PROVIDER_ALIASES) {
			for (const capability of REQUIRED_MODALITY_CAPABILITIES) {
				expect(
					resolveProviderExecutor(provider, capability),
					`${provider} alias should resolve ${capability}`,
				).toBeTruthy();
			}
		}
	});

	it("keeps anthropic on native text path only for now", () => {
		expect(resolveProviderExecutor("anthropic", "text.generate")).toBeTruthy();
		expect(resolveProviderExecutor("anthropic", "images.generations")).toBeNull();
		expect(resolveProviderExecutor("anthropic", "audio.speech")).toBeNull();
		expect(resolveProviderExecutor("anthropic", "video.generation")).toBeNull();
	});
});
