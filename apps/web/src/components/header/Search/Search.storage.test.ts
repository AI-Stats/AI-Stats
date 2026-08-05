import type { PaletteItem } from "./Search.types";
import {
	invalidatePinnedItemsCache,
	PINNED_STORAGE_KEY,
	readPinnedItems,
	togglePinnedItem,
	writePinnedItems,
} from "./Search.storage";

function installStorage(initial: PaletteItem[] = []) {
	const values = new Map([[PINNED_STORAGE_KEY, JSON.stringify(initial)]]);
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			localStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
			},
		},
	});
	return values;
}

afterEach(() => {
	invalidatePinnedItemsCache();
	Reflect.deleteProperty(globalThis, "window");
});

describe("command palette pinned storage", () => {
	it("removes legacy workspace metadata when reading stored pins", () => {
		const values = installStorage([
			{ id: "workspace:private-id", title: "Private workspace", workspaceId: "private-id" },
			{ id: "models", title: "Models", href: "/models" },
		]);

		expect(readPinnedItems()).toEqual([{ id: "models", title: "Models", href: "/models" }]);
		expect(JSON.parse(values.get(PINNED_STORAGE_KEY) ?? "[]")).toEqual([
			{ id: "models", title: "Models", href: "/models" },
		]);
	});

	it("never writes or toggles session-only workspace items", () => {
		const values = installStorage();
		const workspace = {
			id: "workspace:private-id",
			title: "Private workspace",
			workspaceId: "private-id",
			persistable: false,
		};
		const publicItem = { id: "models", title: "Models", href: "/models" };

		expect(writePinnedItems([workspace, publicItem])).toEqual([publicItem]);
		expect(togglePinnedItem([publicItem], workspace)).toEqual([publicItem]);
		expect(JSON.parse(values.get(PINNED_STORAGE_KEY) ?? "[]")).toEqual([publicItem]);
	});
});
