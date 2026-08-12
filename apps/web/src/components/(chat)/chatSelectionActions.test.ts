import {
	appendChatSelectionPrompt,
	buildChatSelectionPrompt,
} from "./chatSelectionActions";

describe("chat selection actions", () => {
	it("builds an editable prompt that keeps the selected text", () => {
		expect(buildChatSelectionPrompt("shorten", "  A long answer.  ")).toBe(
			"Shorten this: A long answer.",
		);
	});

	it("keeps multiline selections on one line", () => {
		expect(buildChatSelectionPrompt("explain", "First line\nSecond line")).toBe(
			"Explain this clearly: First line Second line",
		);
	});

	it("adds the selection prompt after an existing draft", () => {
		expect(appendChatSelectionPrompt("Keep this", "Explain that")).toBe(
			"Keep this\n\nExplain that",
		);
	});

});
