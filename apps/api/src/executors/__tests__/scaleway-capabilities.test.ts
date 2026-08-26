import { describe, expect, it } from "vitest";
import { resolveProviderExecutor } from "../index";

describe("Scaleway capability registration", () => {
	it("registers verified text, embeddings, rerank, and transcription surfaces", () => {
		expect(resolveProviderExecutor("scaleway", "text.generate")).toBeTruthy();
		expect(resolveProviderExecutor("scaleway", "embeddings")).toBeTruthy();
		expect(resolveProviderExecutor("scaleway", "rerank")).toBeTruthy();
		expect(resolveProviderExecutor("scaleway", "audio.transcription")).toBeTruthy();
	});
});
