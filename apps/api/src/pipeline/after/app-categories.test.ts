import { describe, expect, it } from "vitest";

import { mergeAppCategories, normalizeAppCategories } from "./app-categories";

describe("app categories", () => {
    it("normalizes, deduplicates, and limits supported categories", () => {
        expect(normalizeAppCategories(" Productivity,developer-tools,unknown,productivity,chat,finance "))
            .toEqual(["productivity", "developer-tools", "chat"]);
    });

    it("merges request categories without removing stored categories", () => {
        expect(mergeAppCategories("research,education", "productivity,research"))
            .toBe("research,education,productivity");
    });
});
