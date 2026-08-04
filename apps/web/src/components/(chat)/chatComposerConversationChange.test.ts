import { shouldResetComposerForConversationChange } from "./chatComposerConversationChange";

describe("shouldResetComposerForConversationChange", () => {
	it("preserves the composer when temporary mode is toggled on or off", () => {
		expect(
			shouldResetComposerForConversationChange(
				{ activeThreadId: "stored-chat", temporaryMode: false },
				{ activeThreadId: "__temporary_chat__", temporaryMode: true },
			),
		).toBe(false);
		expect(
			shouldResetComposerForConversationChange(
				{ activeThreadId: "__temporary_chat__", temporaryMode: true },
				{ activeThreadId: "stored-chat", temporaryMode: false },
			),
		).toBe(false);
	});

	it("resets the composer when switching between stored chats", () => {
		expect(
			shouldResetComposerForConversationChange(
				{ activeThreadId: "chat-one", temporaryMode: false },
				{ activeThreadId: "chat-two", temporaryMode: false },
			),
		).toBe(true);
	});

	it("retains the initial reset behavior", () => {
		expect(
			shouldResetComposerForConversationChange(null, {
				activeThreadId: "chat-one",
				temporaryMode: false,
			}),
		).toBe(true);
	});
});
