import { describe, expect, it } from "vitest";

import { ensureAppId, normalizeAppAttributionText } from "./apps";

describe("ensureAppId", () => {
	it("does not create an app without explicit user attribution", async () => {
		await expect(ensureAppId({ workspaceId: "workspace_1" })).resolves.toBeNull();
	});

	it("removes PostgreSQL-invalid NULs without discarding the attribution", () => {
		expect(normalizeAppAttributionText(" Phaseo\u0000 Studio ")).toBe("Phaseo Studio");
		expect(normalizeAppAttributionText("\u0000\u0000")).toBeNull();
	});

	it("does not attempt persistence for NUL-only attribution", async () => {
		await expect(ensureAppId({ workspaceId: "workspace_1", appTitle: "\u0000" })).resolves.toBeNull();
	});

	it.each([
		{ appTitle: "App" },
		{ appName: "Unknown app" },
		{ appId: "app" },
		{ appId: "Unknown app" },
		{ referer: "about:blank" },
	])("does not create an app from meaningless attribution: %o", async (attribution) => {
		await expect(ensureAppId({ workspaceId: "workspace_1", ...attribution })).resolves.toBeNull();
	});
});
