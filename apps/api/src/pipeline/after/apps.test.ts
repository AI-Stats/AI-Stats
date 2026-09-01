import { describe, expect, it } from "vitest";

import { ensureAppId, normalizeAppAttributionText } from "./apps";

describe("ensureAppId", () => {
	it("does not create an app without explicit user attribution", async () => {
		await expect(ensureAppId({ workspaceId: "workspace_1" })).resolves.toBeNull();
	});

	it.each([
		{ appTitle: "App" },
		{ appName: "Unknown app" },
		{ appId: "app" },
		{ referer: "about:blank" },
	])("does not create an app from meaningless attribution: %o", async (attribution) => {
		await expect(ensureAppId({ workspaceId: "workspace_1", ...attribution })).resolves.toBeNull();
	});
});
