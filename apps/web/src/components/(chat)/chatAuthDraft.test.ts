import {
	clearChatAuthDraft,
	consumeChatAuthDraft,
	readChatAuthDraft,
	saveChatAuthDraft,
} from "./chatAuthDraft";

function createStorage(): Storage {
	const values = new Map<string, string>();
	return {
		get length() { return values.size; },
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => [...values.keys()][index] ?? null,
		removeItem: (key) => { values.delete(key); },
		setItem: (key, value) => { values.set(key, value); },
	};
}

describe("Chat auth drafts", () => {
	it("restores a saved prompt once without changing its contents", () => {
		const storage = createStorage();
		saveChatAuthDraft("  Explain this trace  ", { storage, now: 1_000 });

		expect(consumeChatAuthDraft({ storage, now: 2_000 })).toBe("  Explain this trace  ");
		expect(consumeChatAuthDraft({ storage, now: 2_000 })).toBeNull();
	});

	it("can read without consuming until restoration completes", () => {
		const storage = createStorage();
		saveChatAuthDraft("Strict mode prompt", { storage, now: 1_000 });

		expect(readChatAuthDraft({ storage, now: 2_000 })).toBe("Strict mode prompt");
		expect(readChatAuthDraft({ storage, now: 2_000 })).toBe("Strict mode prompt");
		clearChatAuthDraft(storage);
		expect(readChatAuthDraft({ storage, now: 2_000 })).toBeNull();
	});

	it("discards expired and malformed drafts", () => {
		const storage = createStorage();
		saveChatAuthDraft("Old prompt", { storage, now: 1_000 });
		expect(consumeChatAuthDraft({ storage, now: 1_000 + 31 * 60 * 1_000 })).toBeNull();

		storage.setItem("phaseo:chat:auth-draft:v1", "not-json");
		expect(consumeChatAuthDraft({ storage, now: 2_000 })).toBeNull();
	});

	it("does not persist empty prompts", () => {
		const storage = createStorage();
		saveChatAuthDraft("   ", { storage, now: 1_000 });
		expect(consumeChatAuthDraft({ storage, now: 1_000 })).toBeNull();
	});
});
