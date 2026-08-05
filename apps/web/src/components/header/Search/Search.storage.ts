import type { PaletteItem } from "./Search.types";

export const PINNED_STORAGE_KEY = "phaseo:command-palette:pinned:v1";
const MAX_PINNED_ITEMS = 12;
let pinnedCache: PaletteItem[] | null = null;

function isPaletteItem(value: unknown): value is PaletteItem {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<PaletteItem>;
	return typeof item.id === "string" && typeof item.title === "string";
}

function isPersistablePinnedItem(item: PaletteItem): boolean {
	return item.persistable !== false && !item.id.startsWith("workspace:");
}

export function readPinnedItems(): PaletteItem[] {
	if (pinnedCache) return pinnedCache;
	if (typeof window === "undefined") return [];
	try {
		const rawValue = window.localStorage.getItem(PINNED_STORAGE_KEY);
		const parsed = rawValue ? (JSON.parse(rawValue) as unknown) : [];
		const storedItems = Array.isArray(parsed) ? parsed.filter(isPaletteItem) : [];
		pinnedCache = storedItems.filter(isPersistablePinnedItem).slice(0, MAX_PINNED_ITEMS);
		if (pinnedCache.length !== storedItems.length) {
			window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedCache));
		}
	} catch {
		pinnedCache = [];
	}
	return pinnedCache;
}

export function writePinnedItems(items: readonly PaletteItem[]): PaletteItem[] {
	const normalized = items
		.filter(isPersistablePinnedItem)
		.slice(0, MAX_PINNED_ITEMS)
		.map((item) => ({ ...item }));
	pinnedCache = normalized;
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(normalized));
		} catch {
			// The palette still works when storage is unavailable or full.
		}
	}
	return normalized;
}

export function togglePinnedItem(items: readonly PaletteItem[], item: PaletteItem): PaletteItem[] {
	if (!isPersistablePinnedItem(item)) return items.filter(isPersistablePinnedItem);
	if (items.some((candidate) => candidate.id === item.id)) {
		return items.filter((candidate) => candidate.id !== item.id);
	}
	return [item, ...items].slice(0, MAX_PINNED_ITEMS);
}

export function invalidatePinnedItemsCache(): void {
	pinnedCache = null;
}
