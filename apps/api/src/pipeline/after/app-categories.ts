export const APP_CATEGORIES = [
    "chat",
    "developer-tools",
    "research",
    "productivity",
    "education",
    "commerce",
    "media",
    "finance",
    "other",
] as const;

const APP_CATEGORY_SET = new Set<string>(APP_CATEGORIES);
export const MAX_APP_CATEGORIES = 3;

export function normalizeAppCategories(value?: string | null): string[] {
    if (!value) return [];
    const categories: string[] = [];
    for (const item of value.split(",")) {
        const category = item.trim().toLowerCase();
        if (!APP_CATEGORY_SET.has(category) || categories.includes(category)) continue;
        categories.push(category);
        if (categories.length >= MAX_APP_CATEGORIES) break;
    }
    return categories;
}

export function mergeAppCategories(...values: Array<string | null | undefined>): string | null {
    return normalizeAppCategories(values.filter(Boolean).join(",")).join(",") || null;
}
