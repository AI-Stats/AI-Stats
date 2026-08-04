import {
	CHAT_DEFAULT_MODEL_IDS,
	FEATURED_MODEL_IDS,
} from "./playgroundConfig";

const CURRENT_FEATURED_MODEL_IDS = [
	"z-ai/glm-5.2",
	"moonshotai/kimi-k3",
	"anthropic/claude-fable-5",
	"minimax/minimax-m3",
	"anthropic/claude-opus-5",
	"spacex-ai/grok-4.5",
	"openai/gpt-5.6-sol",
	"google/gemini-3.6-flash",
];

describe("chat featured models", () => {
	it("uses the current featured model generations", () => {
		expect(FEATURED_MODEL_IDS).toEqual(CURRENT_FEATURED_MODEL_IDS);
		expect(CHAT_DEFAULT_MODEL_IDS).toEqual(CURRENT_FEATURED_MODEL_IDS);
	});
});
