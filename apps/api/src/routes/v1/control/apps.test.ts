import { describe, expect, it } from "vitest";
import { normalizeAppUpdate } from "./apps";

describe("gateway app management validation", () => {
	it("normalizes editable metadata", () => {
		expect(normalizeAppUpdate({ title: " Support bot ", docs_url: "https://example.com/docs", category: "Support, support, Chat" })).toEqual({ value: { title: "Support bot", docs_url: "https://example.com/docs", category: "support,chat" } });
	});
	it("rejects non-HTTP metadata URLs", () => {
		expect(normalizeAppUpdate({ docs_url: "javascript:alert(1)" })).toEqual({ error: "docs_url_invalid" });
	});
});
