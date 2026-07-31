import type { ChatThread } from "@/lib/indexeddb/chats";

export type ChatConversationOutlineItem = {
	id: string;
	label: string;
	messageIndex: number;
};

const OUTLINE_LABEL_MAX_LENGTH = 160;

function formatOutlineLabel(content: string) {
	const normalized = content.replace(/\s+/g, " ").trim() || "Attachment";
	if (normalized.length <= OUTLINE_LABEL_MAX_LENGTH) return normalized;
	return `${normalized.slice(0, OUTLINE_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}

export function getChatConversationOutlineItems(
	messages: ChatThread["messages"],
): ChatConversationOutlineItem[] {
	return messages.flatMap((message, messageIndex) => {
		if (message.role !== "user") return [];

		return [
			{
				id: message.id,
				label: formatOutlineLabel(message.content),
				messageIndex,
			},
		];
	});
}
