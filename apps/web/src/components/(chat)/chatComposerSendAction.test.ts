import { getChatComposerSendAction } from "./chatComposerSendAction";

describe("getChatComposerSendAction", () => {
	it("opens model selection when content is ready but no model is selected", () => {
		expect(
			getChatComposerSendAction({
				hasComposerContent: true,
				hasSelectedModel: false,
				isRecording: false,
				slashMenuOpen: false,
			}),
		).toBe("open-model-selector");
	});

	it("submits when content and a selected model are present", () => {
		expect(
			getChatComposerSendAction({
				hasComposerContent: true,
				hasSelectedModel: true,
				isRecording: false,
				slashMenuOpen: false,
			}),
		).toBe("submit");
	});

	it.each([
		{ hasComposerContent: false, isRecording: false, slashMenuOpen: false },
		{ hasComposerContent: true, isRecording: true, slashMenuOpen: false },
		{ hasComposerContent: true, isRecording: false, slashMenuOpen: true },
	])("does nothing when the composer cannot act: %o", (state) => {
		expect(
			getChatComposerSendAction({
				...state,
				hasSelectedModel: false,
			}),
		).toBe("none");
	});
});
