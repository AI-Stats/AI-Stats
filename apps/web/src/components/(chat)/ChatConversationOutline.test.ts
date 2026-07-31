import { getChatConversationOutlineItems } from "./chatConversationOutline";
import type { ChatThread } from "@/lib/indexeddb/chats";

describe("getChatConversationOutlineItems", () => {
	it("creates navigation entries for user turns only", () => {
		const messages: ChatThread["messages"] = [
			{
				id: "user-1",
				role: "user",
				content: "  Compare\nthese models  ",
				createdAt: "2026-07-30T12:00:00.000Z",
			},
			{
				id: "assistant-1",
				role: "assistant",
				content: "Here is the comparison.",
				createdAt: "2026-07-30T12:00:01.000Z",
			},
			{
				id: "user-2",
				role: "user",
				content: "",
				createdAt: "2026-07-30T12:01:00.000Z",
			},
		];

		expect(getChatConversationOutlineItems(messages)).toEqual([
			{
				id: "user-1",
				label: "Compare these models",
				messageIndex: 0,
			},
			{
				id: "user-2",
				label: "Attachment",
				messageIndex: 2,
			},
		]);
	});

	it("keeps very long prompts compact", () => {
		const messages: ChatThread["messages"] = [
			{
				id: "user-1",
				role: "user",
				content: "a".repeat(180),
				createdAt: "2026-07-30T12:00:00.000Z",
			},
		];

		expect(getChatConversationOutlineItems(messages)[0]?.label).toBe(
			`${"a".repeat(159)}…`,
		);
	});
});
